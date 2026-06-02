# Chasing Darkness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pursuing "night" that catches the bird when it's too slow, with one unified nightfall animation for every loss, and replace the three flaky "stopped" loss triggers with a single robust progress detector.

**Architecture:** A world-space `G.nightX` advances at a steady pace; the gap `G.bx - G.nightX` is the slow-pressure loss. A single progress detector (high-water-mark + timeout) is the instant loss. Both route through one `triggerNightfall()` state machine (surge → engulf → settle → `endRun`). An animated "ink wash" layer renders the front. All in `tinywings/index.html`.

**Tech Stack:** Plain static HTML/CSS/JS (no build step), canvas 2D, headless Playwright for verification (no unit-test runner).

---

## Verification context (no test framework)

This repo has **no test runner**. Verification is static (`node --check` of an
extracted script body) plus **headless Playwright** driving the served page,
using the pattern from the `project-tinywings-playtest-driver` memory:

- Playwright is CommonJS at `/home/ubuntu/.hermes/hermes-agent/node_modules/playwright`
  — `require()` it from a `.cjs` file, launch with `args:['--no-sandbox']`.
- Serve the repo: `cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8753`
  (run in background). Load `http://localhost:8753/tinywings/`.
- The canvas swallows pointer events; dismiss the intro with
  `page.evaluate(()=>document.querySelector('#skipIntroBtn')?.click())` and drive
  the game state directly via the debug hook.
- **Debug hook:** Task 1 temporarily adds `window.__TW_DEBUG_G = G;` right after the
  `G = {...}` literal. Every verification reads/writes `window.__TW_DEBUG_G`.
  **Task 6 removes the hook before the final commit** — it must never ship.
- Each task: serve, drive, assert, then a smoke check for console/page errors.
- Commit **only** `tinywings/` files (the user often has parallel work in the tree).

## File structure

All changes are in **`tinywings/index.html`** (single-file demo, per repo
convention) plus a cache bump in **`tinywings/sw.js`** and deletion of the
temporary **`scratch-night-front.html`**. The night logic is added as a small
cluster of named functions (`updateNight`, `checkStopped`, `triggerNightfall`,
`updateNightfall`, `drawNight`) so each is understandable in isolation.

Key existing anchors (line numbers approximate — read before editing):
- `PHYS_DEFAULTS` / `TUNER_SCHEMA` ~line 1783 / 1804
- `G = { ... }` literal: spawn fields ~1281, boost/press ~1291, score ~1296,
  stars/clouds end ~1320.
- `startGame` reset block ~1426–1462.
- `physicsStep(dt)` opens ~1894 with `if (G.gameOver) return;`.
- The three-counter loss block ~2189–2234 (this is what Task 4 replaces).
- `endRun(reason)` ~2284.
- Main `frame(now)` render loop ~2947; physics ticked ~2956; `drawTransitionOverlay()`
  ~3000 just before `requestAnimationFrame`.
- `reduceMotion` boolean already defined ~1066.

---

## Task 1: Constants, state, reset, and the debug hook

**Files:** Modify `tinywings/index.html`

- [ ] **Step 1: Add night/stop constants next to the physics constants**

After the `PERFECT_ANGLE_DEG` line (~1799, right after `const STALL_ANGLE_DEG`/
`PERFECT_ANGLE_DEG`), insert:

```js
    // ── Chasing-night constants ──────────────────────────────────
    // The night is a world-space front (NIGHT_X) advancing at a steady pace.
    // The bird's speed is what outruns it. Tuned below a competent cruise
    // (spawn vx=420, LIFT_VMIN=180, VMAX=1100) so a flowing run pulls away.
    const NIGHT = {
      PACE:       210,   // px/s the front advances (steady; no rubber-banding)
      START_GAP: 1200,   // px the front starts behind the bird each run (~85 m)
      SURGE_MS:   260,   // on a hard stop, lerp the front to the bird over this
      NEAR_M:      30,   // gap (m) under which the proximity cue intensifies
      // Stop detector (replaces stuckMs/noProgressMs/backslideMs):
      PROGRESS_MIN: 12,  // px of forward high-water gain that counts as progress
      STOP_MS:    1300,  // no progress for this long (while armed) = instant loss
    };
```

- [ ] **Step 2: Add night/stop/nightfall fields to the `G` state literal**

In the `G = { ... }` literal, find the Boost block (the lines added previously):

```js
      // Boost
      boost: 0,               // 0..1
      boostingNow: false,
      boostFlashUntil: 0,     // wall-clock time the boost trail/flash visual lasts until
```

Immediately AFTER that boost block, insert:

```js
      // Chasing night
      nightX: -1e9,           // world-x of the night front's leading edge
      maxBx: 200,             // furthest world-x reached (progress high-water mark)
      lastProgressAt: 0,      // wall-clock time maxBx last advanced by PROGRESS_MIN
      nightfall: { active: false, startedAt: 0, phase: "engulf", surge: false, surgeFromX: 0, reason: "" },
```

- [ ] **Step 3: Reset the new state in `startGame`**

In `startGame`, find the reset line `G.flightStartT = performance.now();`
(~1440) and insert AFTER it:

```js
      G.nightX = 200 - NIGHT.START_GAP; // spawn bx is 200; front starts START_GAP behind
      G.maxBx = 200;
      G.lastProgressAt = performance.now();
      G.nightfall = { active: false, startedAt: 0, phase: "engulf", surge: false, surgeFromX: 0, reason: "" };
```

- [ ] **Step 4: Add the temporary debug hook**

Find the close of the `G` literal:

```js
      // Stars (night) and clouds (other days)
      stars: [],
      clouds: [],
    };
```

Insert immediately after the closing `};`:

```js
    window.__TW_DEBUG_G = G; // TEMPORARY — removed in the final task. Do not ship.
```

- [ ] **Step 5: Verify syntax + state present**

Serve (`python3 -m http.server 8753` in repo root, background). Then:

```bash
cat > /tmp/cd_t1.cjs <<'EOF'
const { chromium } = require('/home/ubuntu/.hermes/hermes-agent/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
  await p.goto('http://localhost:8753/tinywings/', { waitUntil:'networkidle' });
  await p.waitForTimeout(1500);
  await p.evaluate(()=>document.querySelector('#skipIntroBtn')?.click());
  await p.waitForTimeout(300);
  const s = await p.evaluate(()=>{const G=window.__TW_DEBUG_G;return {
    nightX:G.nightX, maxBx:G.maxBx, gap:Math.round(G.bx-G.nightX),
    nf:!!G.nightfall, paceConst: (typeof NIGHT!=='undefined')?NIGHT.PACE:'n/a'
  };});
  console.log(JSON.stringify({s, errs}));
  await b.close();
})();
EOF
node /tmp/cd_t1.cjs
```

Expected: `nightX` ≈ `bx - 1200`, `gap` ≈ 1200 (the START_GAP), `nf:true`, no errors.
(`NIGHT.PACE` won't be reachable from `evaluate` scope — ignore `paceConst`; the
gap value proves the constant was applied in `startGame`.)

- [ ] **Step 6: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: add chasing-night constants, state, reset (+ temp debug hook)"
```

---

## Task 2: Night-front advance (no loss, no visual yet)

**Files:** Modify `tinywings/index.html`

- [ ] **Step 1: Add `updateNight` and a progress tracker helper**

Immediately BEFORE `function physicsStep(dt) {` (~1894), insert:

```js
    // Advance the night front at a steady world pace. Frozen during the
    // tutorial and during the nightfall animation. Catch detection lives in
    // Task 4's loss block; here the front only MOVES.
    function updateNight(dt) {
      if (G.tutorial || G.nightfall.active) return;
      G.nightX += NIGHT.PACE * dt;
    }
```

- [ ] **Step 2: Call `updateNight` from `physicsStep`**

`physicsStep` opens:

```js
    function physicsStep(dt) {
      if (G.gameOver) return;
```

Insert immediately after the `if (G.gameOver) return;` line:

```js
      updateNight(dt);
```

- [ ] **Step 3: Verify the front advances and the gap responds to speed**

Serve. Drive an idle bird vs a fast bird and confirm the gap shrinks vs grows:

```bash
cat > /tmp/cd_t2.cjs <<'EOF'
const { chromium } = require('/home/ubuntu/.hermes/hermes-agent/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message));
  await p.goto('http://localhost:8753/tinywings/', { waitUntil:'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#skipIntroBtn')?.click());
  await p.waitForTimeout(300);
  // Pin the bird in place (idle) and watch the gap shrink as the front advances.
  const idle = await p.evaluate(async ()=>{
    const G=window.__TW_DEBUG_G; G.tutorial=false; G.gameOver=false;
    G.vx=0; G.vy=0; const g0=G.bx-G.nightX;
    // freeze bx by re-pinning each frame for ~600ms
    const end=performance.now()+600;
    while(performance.now()<end){ G.bx=200; await new Promise(r=>requestAnimationFrame(r)); }
    return { g0:Math.round(g0), g1:Math.round(G.bx-G.nightX) };
  });
  console.log(JSON.stringify({idle, frontAdvanced: idle.g1 < idle.g0, errs}));
  await b.close();
})();
EOF
node /tmp/cd_t2.cjs
```

Expected: `frontAdvanced: true` (gap shrank because the bird was pinned while the
front advanced ~126px over 600ms). No errors.

- [ ] **Step 4: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: night front advances at steady pace (not yet lethal/visible)"
```

---

## Task 3: Nightfall state machine + physics freeze + reduced-motion

**Files:** Modify `tinywings/index.html`

- [ ] **Step 1: Add `triggerNightfall` and `updateNightfall`**

Immediately BEFORE `function endRun(reason) {` (~2284), insert:

```js
    // Single entry point for ALL losses. cause = end-card reason string.
    // opts.surge = true makes the front rush in (used by the instant stop loss);
    // the night-catch loss passes surge:false (front is already at the bird).
    function triggerNightfall(cause, opts) {
      if (G.nightfall.active || G.gameOver) return;
      const surge = !!(opts && opts.surge);
      G.nightfall = {
        active: true,
        startedAt: performance.now(),
        phase: surge ? "surge" : "engulf",
        surge,
        surgeFromX: G.nightX,
        reason: cause || "the night caught you",
      };
      blip(180, 0.5, "sine", 0.10);
    }

    // Advances the nightfall animation by wall-clock time. Called every frame
    // from frame() (physicsStep is frozen while nightfall is active, so the
    // bird stops, but the animation must keep progressing). Reduced motion
    // collapses surge+engulf+settle into a quick cross-fade.
    function updateNightfall(now) {
      const nf = G.nightfall;
      if (!nf.active) return;
      const t = now - nf.startedAt;
      if (reduceMotion) {
        // ~300ms straight to night, then the card.
        G.nightX = G.bx; // front fully over the bird
        if (t >= 300 && nf.phase !== "done") { nf.phase = "done"; endRun(nf.reason); }
        return;
      }
      const SURGE = NIGHT.SURGE_MS, ENGULF = 900, SETTLE = 500;
      if (nf.phase === "surge") {
        // Ease the front to the bird over SURGE_MS, then engulf.
        const k = Math.min(1, t / SURGE);
        const e = k * k * (3 - 2 * k); // smoothstep
        G.nightX = nf.surgeFromX + (G.bx - nf.surgeFromX) * e;
        if (t >= SURGE) { nf.phase = "engulf"; nf.startedAt = now; }
        return;
      }
      if (nf.phase === "engulf") {
        // Push the front PAST the bird so the ink floods the whole screen.
        const k = Math.min(1, t / ENGULF);
        const e = k * k; // accelerate
        G.nightX = G.bx + e * (viewW * 1.2); // well past the right edge in world px ≈ screen px
        if (t >= ENGULF) { nf.phase = "settle"; nf.startedAt = now; }
        return;
      }
      if (nf.phase === "settle") {
        if (t >= SETTLE) { nf.phase = "done"; endRun(nf.reason); }
        return;
      }
    }
```

- [ ] **Step 2: Freeze physics while nightfall is active**

`physicsStep` now opens (after Task 2):

```js
    function physicsStep(dt) {
      if (G.gameOver) return;
      updateNight(dt);
```

Change it to add the freeze BETWEEN the gameOver guard and `updateNight`:

```js
    function physicsStep(dt) {
      if (G.gameOver) return;
      if (G.nightfall.active) return; // bird frozen during the nightfall animation
      updateNight(dt);
```

- [ ] **Step 3: Call `updateNightfall` from the render loop**

In `frame(now)`, the physics is ticked then rendering begins. Find:

```js
      for (let i = 0; i < sub; i++) physicsStep(dts);

      // Render
      ctx.clearRect(0, 0, viewW, viewH);
```

Insert the nightfall update BETWEEN the physics loop and `// Render`:

```js
      for (let i = 0; i < sub; i++) physicsStep(dts);

      updateNightfall(now); // progresses the loss animation (physics is frozen meanwhile)

      // Render
      ctx.clearRect(0, 0, viewW, viewH);
```

- [ ] **Step 4: Verify the sequence runs and ends the run (manual trigger)**

Serve. Trigger nightfall directly and confirm it freezes the bird, walks the
phases, and shows the end card:

```bash
cat > /tmp/cd_t3.cjs <<'EOF'
const { chromium } = require('/home/ubuntu/.hermes/hermes-agent/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
  await p.goto('http://localhost:8753/tinywings/', { waitUntil:'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#skipIntroBtn')?.click());
  await p.waitForTimeout(300);
  const r = await p.evaluate(async ()=>{
    const G=window.__TW_DEBUG_G; G.tutorial=false; G.gameOver=false; G.nightfall.active=false;
    triggerNightfall("the night caught you", { surge:true });
    const active0 = G.nightfall.active, phase0 = G.nightfall.phase;
    await new Promise(r=>setTimeout(r,2000)); // longer than surge+engulf+settle
    return { active0, phase0, gameOverAfter:G.gameOver,
             endLive: document.getElementById('endPanel')?.classList.contains('live'),
             reasonText: document.getElementById('endReason')?.textContent };
  });
  console.log(JSON.stringify({r, errs}));
  await b.close();
})();
EOF
node /tmp/cd_t3.cjs
```

Expected: `active0:true`, `phase0:"surge"`, `gameOverAfter:true`, `endLive:true`,
`reasonText` contains `THE NIGHT CAUGHT YOU`. No errors.

- [ ] **Step 5: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: nightfall state machine (surge/engulf/settle) + physics freeze + reduced-motion"
```

---

## Task 4: Wire the two loss paths; remove the three old counters

**Files:** Modify `tinywings/index.html`

- [ ] **Step 1: Add the consolidated stop detector**

Immediately AFTER the `updateNight` function (added in Task 2, before
`physicsStep`), insert:

```js
    // Single progress detector — replaces stuckMs / noProgressMs / backslideMs.
    // Tracks the forward high-water mark (maxBx). If it fails to advance by
    // PROGRESS_MIN within STOP_MS (while loss is armed), the bird has stopped:
    // frozen, crawling-in-place, or backsliding all collapse to "no high-water
    // progress". Returns true if a stop-loss should fire this frame.
    function checkStopped(now, armed) {
      if (G.bx > G.maxBx + NIGHT.PROGRESS_MIN) {
        G.maxBx = G.bx;
        G.lastProgressAt = now;
        return false;
      }
      if (G.bx > G.maxBx) G.maxBx = G.bx; // creep the mark up on tiny gains, no timer reset
      if (!armed) { G.lastProgressAt = now; return false; } // don't accumulate while unarmed
      return (now - G.lastProgressAt) >= NIGHT.STOP_MS;
    }
```

- [ ] **Step 2: Replace the three-counter loss block with the two paths**

Find the entire old block (~2189–2234):

```js
      const sinceStart = performance.now() - G.flightStartT;
      // Loss triggers are suppressed during the tutorial and during the
      // post-tutorial grace window (a freshly-taught player gets ~3s to fumble
      // their first hills without dying). We still ACCUMULATE the timers during
      // grace so the run ends promptly if the bird is still genuinely stuck the
      // instant grace lapses — grace softens the cliff, it doesn't hide a
      // permanently-dead bird.
      const lossArmed = !G.tutorial && performance.now() >= G.graceUntil;
      if (sinceStart > 800) {
        // Use SIGNED forward velocity (vx itself, not |vx|). A bird in
        // a valley bouncing backward at vx=-80 has |vx|=80 which clears
        // the gate and feels alive — but it isn't going anywhere. The
        // signed check catches "going nowhere or backward" with one
        // condition, and the absolute-stall case (vx near zero) is a
        // subset of it.
        if (G.vx < 60) {
          G.stuckMs += dt * 1000;
          if (G.stuckMs > 1000 && lossArmed) endRun("the wind has settled");
        } else {
          G.stuckMs = 0;
        }
        // Forward-progress watchdog: bird must gain ≥10 px every 1200ms.
        // The old +40 px threshold let a bird oscillating ±41 px reset
        // the watermark on every cycle and never trip — visually frozen
        // but technically advancing. 10 px / 1.2 s catches that case.
        if (G.bx > G.stuckCheckBx + 10) {
          G.stuckCheckBx = G.bx;
          G.noProgressMs = 0;
        } else {
          G.noProgressMs += dt * 1000;
          if (G.noProgressMs > 1200 && lossArmed) endRun("out of speed");
        }
        // Backslide trigger needs hysteresis — a single 60px transient
        // from a steep ramp-bounce shouldn't end the run instantly. The
        // bird must be ≥60 px below the watermark for ≥250 ms.
        if (G.bx < G.stuckCheckBx - 60) {
          G.backslideMs += dt * 1000;
          if (G.backslideMs > 250 && lossArmed) endRun("shoved back");
        } else {
          G.backslideMs = 0;
        }
      }
      // If any of the three triggers ended the run this frame, stop
      // here — the rest of the function (day timer, HUD, distance HWM)
      // shouldn't keep ticking on a dead bird.
      if (G.gameOver) return;
```

Replace the WHOLE block above with:

```js
      const sinceStart = performance.now() - G.flightStartT;
      // Loss is suppressed during the tutorial and the post-tutorial grace
      // window. Two clean paths, both ending the run via the nightfall
      // sequence so every death reads as "the night caught you":
      //   Path 1 — STOPPED: one progress detector (replaces the old three
      //            stuck/no-progress/backslide counters) → instant loss, the
      //            front SURGES in to meet the stalled bird.
      //   Path 2 — NIGHT: the steady front catches a too-slow bird (bx<=nightX).
      const now = performance.now();
      const lossArmed = !G.tutorial && now >= G.graceUntil;
      if (sinceStart > 800 && !G.nightfall.active) {
        if (checkStopped(now, lossArmed)) {
          triggerNightfall("the night caught you", { surge: true });
        } else if (lossArmed && G.bx - G.nightX <= 0) {
          triggerNightfall("the night caught you", { surge: false });
        }
      }
      // A loss this frame starts the nightfall animation and freezes physics;
      // don't keep ticking the day timer / HUD on a caught bird.
      if (G.gameOver || G.nightfall.active) return;
```

- [ ] **Step 3: Remove the now-dead counter state**

In the `G` literal, the score block contains the old counters:

```js
      stuckMs: 0,              // time spent at near-zero speed on slope
      noProgressMs: 0,         // time since maxBx last advanced
      stuckCheckBx: 0,         // bx watermark for noProgressMs
      backslideMs: 0,          // sustained-backslide hysteresis
```

Delete those four lines. Then in `startGame`, delete their reset lines:

```js
      G.stuckMs = 0;
      G.noProgressMs = 0;
      G.stuckCheckBx = 200;
      G.backslideMs = 0;
```

(Leave `G.maxBx`, `G.lastProgressAt`, `G.nightX`, `G.nightfall` resets from Task 1 in place.)

- [ ] **Step 4: Verify both loss paths fire nightfall; old reasons gone**

Serve. Test (a) a stall → stop-loss with surge, (b) a moving-but-slow bird caught
by the front, and (c) that the old reason strings never appear:

```bash
cat > /tmp/cd_t4.cjs <<'EOF'
const { chromium } = require('/home/ubuntu/.hermes/hermes-agent/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
  await p.goto('http://localhost:8753/tinywings/', { waitUntil:'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#skipIntroBtn')?.click());
  await p.waitForTimeout(300);
  // (a) STOP: pin the bird, fast-forward past STOP_MS, expect surge nightfall.
  const stop = await p.evaluate(async ()=>{
    const G=window.__TW_DEBUG_G; G.tutorial=false; G.graceUntil=0; G.gameOver=false;
    G.nightfall.active=false; G.flightStartT=performance.now()-2000;
    G.maxBx=G.bx; G.lastProgressAt=performance.now()-2000; // already STOP_MS stale
    G.nightX=G.bx-1000; // far behind, so only the stop path can fire
    const end=performance.now()+400;
    while(performance.now()<end && !G.nightfall.active){ G.vx=0; G.bx=Math.max(200,G.bx); await new Promise(r=>requestAnimationFrame(r)); }
    return { fired:G.nightfall.active, surge:G.nightfall.surge, reason:G.nightfall.reason };
  });
  // reload for a clean second scenario
  await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(1000);
  await p.evaluate(()=>document.querySelector('#skipIntroBtn')?.click()); await p.waitForTimeout(300);
  // (b) NIGHT catch: keep bird moving forward a little (so stop doesn't fire) but
  // put the front right on it.
  const night = await p.evaluate(async ()=>{
    const G=window.__TW_DEBUG_G; G.tutorial=false; G.graceUntil=0; G.gameOver=false;
    G.nightfall.active=false; G.flightStartT=performance.now()-2000;
    G.maxBx=G.bx; G.lastProgressAt=performance.now(); // fresh progress → stop path won't fire
    let fired=false;
    const end=performance.now()+400;
    while(performance.now()<end && !G.nightfall.active){
      G.bx+=3; G.maxBx=G.bx; G.lastProgressAt=performance.now(); // keep advancing
      G.nightX=G.bx+1; // front already past the bird
      await new Promise(r=>requestAnimationFrame(r));
    }
    return { fired:G.nightfall.active, surge:G.nightfall.surge, reason:G.nightfall.reason };
  });
  const html = await p.content();
  const oldReasons = ['the wind has settled','out of speed','shoved back'].filter(s=>html.includes(s));
  console.log(JSON.stringify({stop, night, oldReasonsPresent:oldReasons, errs}));
  await b.close();
})();
EOF
node /tmp/cd_t4.cjs
```

Expected: `stop.fired:true, stop.surge:true`; `night.fired:true, night.surge:false`;
both reasons `the night caught you`; `oldReasonsPresent:[]`; no errors.

- [ ] **Step 5: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: route both loss paths through nightfall; replace 3 counters with one stop detector"
```

---

## Task 5: Animated ink-wash visual + proximity cue

**Files:** Modify `tinywings/index.html`

- [ ] **Step 1: Initialise the blot particle set once**

In the `G` literal, after the `nightfall: {...}` line added in Task 1, add a
blot array field:

```js
      nightBlots: [],         // fixed drifting ink blots near the front edge
```

In `startGame`, after the `G.nightfall = {...}` reset line, seed the blots
deterministically (so they drift, never teleport):

```js
      G.nightBlots = [];
      { const r = mulberry32((G.seed ^ 0x51ed) >>> 0);
        for (let i = 0; i < 7; i++) G.nightBlots.push({
          off: -10 - r() * 80,        // px behind the edge (negative = left)
          yf: 0.08 + r() * 0.84,      // vertical fraction of canvas height
          rad: 10 + r() * 22,         // blot radius
          bob: 6 + r() * 10,          // vertical bob amplitude (px)
          ph: r() * 6.283,            // phase
          spd: 0.5 + r() * 0.8,       // bob speed
        }); }
```

- [ ] **Step 2: Add `drawNight()`**

Immediately BEFORE `function frame(now) {` (~2947), insert. This draws a
left-anchored ink layer whose right edge sits at the screen-x of `G.nightX`,
with a continuously flowing (time-driven) wobble — never per-frame randomness:

```js
    // Animated "ink wash" front. The right edge sits at the screen-x of nightX
    // and undulates via time-driven sines (seamless — no per-frame jumps).
    // Blots drift with the edge; stars fade in by how engulfing the front is.
    function drawNight(camX, now) {
      const edgeScreen = G.nightX - camX;
      if (edgeScreen < -40) return; // front entirely off the left — nothing to draw
      const t = now / 1000;
      const H = viewH;
      // Wobbling edge: two low-frequency sines summed, advancing in t.
      const samples = 22, amp1 = 14, amp2 = 7;
      function edgeAt(y) {
        return edgeScreen
          + Math.sin(y * 0.011 + t * 0.7) * amp1
          + Math.sin(y * 0.027 - t * 1.1) * amp2;
      }
      // Body fill (deep night → feathered toward the edge).
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      for (let i = 0; i <= samples; i++) {
        const y = (H * i) / samples;
        ctx.lineTo(edgeAt(y), y);
      }
      ctx.lineTo(-2, H + 2);
      ctx.closePath();
      ctx.clip();
      const maxEdge = edgeScreen + amp1 + amp2 + 4;
      const g = ctx.createLinearGradient(0, 0, Math.max(8, maxEdge), 0);
      g.addColorStop(0, "rgba(20, 22, 38, 0.96)");
      g.addColorStop(0.75, "rgba(34, 40, 60, 0.80)");
      g.addColorStop(1, "rgba(40, 46, 66, 0.0)"); // feathered leading edge
      ctx.fillStyle = g;
      ctx.fillRect(-2, -2, maxEdge + 4, H + 4);
      // Stars inside (fade in with how far the edge has crossed the screen).
      const cross = Math.max(0, Math.min(1, edgeScreen / Math.max(1, viewW)));
      if (cross > 0.02 && G.stars && G.stars.length) {
        ctx.fillStyle = `rgba(232, 226, 200, ${(0.85 * cross).toFixed(3)})`;
        for (const s of G.stars) {
          const x = s.x * Math.max(8, edgeScreen);
          const y = s.y * H * 0.7 + 16;
          ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
        }
      }
      ctx.restore();
      // Drifting blots straddling the edge (seamless: bob via time sine).
      for (const bl of G.nightBlots) {
        const bx = edgeScreen + bl.off + Math.sin(t * 0.6 + bl.ph) * 5;
        const by = bl.yf * H + Math.sin(t * bl.spd + bl.ph) * bl.bob;
        const rg = ctx.createRadialGradient(bx, by, 0, bx, by, bl.rad);
        rg.addColorStop(0, "rgba(26, 30, 48, 0.85)");
        rg.addColorStop(1, "rgba(26, 30, 48, 0.0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx, by, bl.rad, 0, 6.283); ctx.fill();
      }
      // Proximity cue: faint extra vignette from the left when the gap is small.
      const gapM = (G.bx - G.nightX) / 14;
      if (!G.nightfall.active && gapM < NIGHT.NEAR_M && gapM > 0) {
        const k = 1 - gapM / NIGHT.NEAR_M; // 0..1 as it nears
        const vg = ctx.createLinearGradient(0, 0, viewW * 0.5, 0);
        vg.addColorStop(0, `rgba(20, 22, 38, ${(0.28 * k).toFixed(3)})`);
        vg.addColorStop(1, "rgba(20, 22, 38, 0)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, viewW * 0.5, H);
      }
    }
```

- [ ] **Step 3: Call `drawNight()` in the render loop**

In `frame(now)`, the night should be drawn over the world/bird but under the
end-card overlay. Find:

```js
      drawBird(sx, sy, angle, G.airborne, G.perfectLaunch, boostVisual);
      drawOffscreenIndicator(sx, sy);
      drawMinimap();
```

Insert AFTER `drawMinimap();`:

```js
      drawNight(camX, now); // ink-wash front, over the world, under the end card
```

- [ ] **Step 4: Verify the layer draws when the front is near, not when far**

Serve. Confirm `drawNight` produces dark pixels on the left when the front is
on-screen, and nothing when it's far off-screen. We sample the canvas:

```bash
cat > /tmp/cd_t5.cjs <<'EOF'
const { chromium } = require('/home/ubuntu/.hermes/hermes-agent/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:900,height:520} });
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
  await p.goto('http://localhost:8753/tinywings/', { waitUntil:'networkidle' });
  await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#skipIntroBtn')?.click());
  await p.waitForTimeout(300);
  // Helper: mean brightness of the left 60px column of the game canvas.
  const sampleLeft = async () => p.evaluate(async ()=>{
    await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
    const c=document.getElementById('sky'); const g=c.getContext('2d');
    const d=g.getImageData(0,0,60,c.height).data; let s=0;
    for(let i=0;i<d.length;i+=4){ s += (d[i]+d[i+1]+d[i+2])/3; }
    return s/(d.length/4);
  });
  // Front FAR off-screen left:
  const far = await p.evaluate(()=>{ const G=window.__TW_DEBUG_G; G.tutorial=false; G.gameOver=false; G.nightX=G.bx-4000; return G.bx-G.nightX; });
  const brightFar = await sampleLeft();
  // Front ON-screen near the bird:
  await p.evaluate(()=>{ const G=window.__TW_DEBUG_G; G.nightX=G.bx-120; });
  const brightNear = await sampleLeft();
  console.log(JSON.stringify({ brightFar:Math.round(brightFar), brightNear:Math.round(brightNear), darkerWhenNear: brightNear < brightFar - 15, errs }));
  await b.close();
})();
EOF
node /tmp/cd_t5.cjs
```

Expected: `darkerWhenNear: true` (left edge is markedly darker when the front is
near). No errors.

- [ ] **Step 5: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: animated ink-wash night front (flowing edge, drifting blots, proximity cue)"
```

---

## Task 6: PHYS tuner entries, SW bump, cleanup, final verification

**Files:** Modify `tinywings/index.html`, `tinywings/sw.js`; delete `scratch-night-front.html`

- [ ] **Step 1: Expose `NIGHT.PACE` and `NIGHT.START_GAP` in the tuner (optional live dial-in)**

The tuner is wired to `PHYS`/`TUNER_SCHEMA` (objects of numbers), not to `NIGHT`.
Rather than refactor the tuner, add the two most useful night knobs as a tiny
read-through: after the `TUNER_SCHEMA` object (~1813), the tuner only iterates
`PHYS`. To keep scope minimal, mirror the two knobs into `PHYS`/`TUNER_SCHEMA` so
they appear as sliders and `updateNight`/`startGame` read them from there.

In `PHYS_DEFAULTS` (~1783), add two entries:

```js
      NIGHT_PACE:    210,   // px/s the chasing night advances
      NIGHT_GAP:    1200,   // px the night starts behind the bird each run
```

In `TUNER_SCHEMA` (~1804), add:

```js
      NIGHT_PACE:    { min: 80,   max: 500,  step: 5,  label: "night · pace",     hint: "how fast the darkness chases. higher = harder" },
      NIGHT_GAP:     { min: 400,  max: 2400, step: 20, label: "night · head start", hint: "how far back the night begins each run" },
```

Then change the two reads: in `updateNight`, `G.nightX += NIGHT.PACE * dt;` →
`G.nightX += PHYS.NIGHT_PACE * dt;`. In `startGame`,
`G.nightX = 200 - NIGHT.START_GAP;` → `G.nightX = 200 - PHYS.NIGHT_GAP;`.
(Leave the other `NIGHT.*` constants — SURGE_MS, NEAR_M, PROGRESS_MIN, STOP_MS —
as code constants; they're not worth slider space.)

- [ ] **Step 2: Remove the debug hook**

Delete the line added in Task 1:

```js
    window.__TW_DEBUG_G = G; // TEMPORARY — removed in the final task. Do not ship.
```

- [ ] **Step 3: Bump the service worker cache**

In `tinywings/sw.js`, change `const CACHE = "vibe-tinywings-v42";` to
`const CACHE = "vibe-tinywings-v43";` (read the file first to confirm the current
number; bump from whatever it actually is).

- [ ] **Step 4: Delete the scratch mockup**

```bash
git rm scratch-night-front.html
```

- [ ] **Step 5: Final verification — full play smoke (no debug hook)**

Serve. Confirm: page loads with no errors, no `__TW_DEBUG_G`, the two new tuner
sliders exist, and a scripted slow run ends via nightfall and shows the end card.

```bash
cat > /tmp/cd_t6.cjs <<'EOF'
const { chromium } = require('/home/ubuntu/.hermes/hermes-agent/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args:['--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:900,height:520} });
  const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text());});
  await p.goto('http://localhost:8753/tinywings/', { waitUntil:'networkidle' });
  await p.waitForTimeout(1500);
  const noHook = await p.evaluate(()=>typeof window.__TW_DEBUG_G);
  const sliders = await p.evaluate(()=>document.body.innerHTML.includes('night · pace') && document.body.innerHTML.includes('night · head start'));
  // Let the intro tutorial/normal play sit a moment; just assert clean load.
  console.log(JSON.stringify({ noHook, sliders, errs }));
  await b.close();
})();
EOF
node /tmp/cd_t6.cjs
```

Expected: `noHook:"undefined"`, `sliders:true`, `errs:[]`.

- [ ] **Step 6: Confirm the debug hook is gone from source**

```bash
grep -n "__TW_DEBUG_G" tinywings/index.html || echo "OK: no debug hook"
```
Expected: `OK: no debug hook`.

- [ ] **Step 7: Commit**

```bash
git add tinywings/index.html tinywings/sw.js
git commit -m "tinywings: night-pace tuner sliders, remove debug hook, SW v43, drop scratch mockup"
```

---

## Self-review notes

- **Spec coverage:** Section 1 night-front model → Tasks 1,2 (constants/state +
  steady advance) and Task 6 (pace/gap as tunables). Section 2 two-path loss →
  Task 4 (consolidated `checkStopped` + night-catch, three counters removed).
  Section 3 nightfall sequence (surge/engulf/settle, freeze, reduced-motion,
  animated ink) → Tasks 3 (state machine + freeze + reduced-motion) and 5 (ink
  visual, seamless flowing edge + drifting blots + stars). Section 4 → cosmetic
  day cycle untouched (verified: the day-timer block at ~2236 is left intact);
  proximity cue (Task 5 Step 2); files all in index.html; SW v43, scratch
  cleanup, headless verification (Task 6). Unified "the night caught you" reason
  (Task 4). All spec sections map to a task.
- **Type/name consistency:** `G.nightX`, `G.maxBx`, `G.lastProgressAt`,
  `G.nightfall{active,startedAt,phase,surge,surgeFromX,reason}`, `G.nightBlots`
  used consistently. Functions: `updateNight(dt)`, `checkStopped(now,armed)`,
  `triggerNightfall(cause,opts)`, `updateNightfall(now)`, `drawNight(camX,now)`.
  `triggerNightfall` always called with `{surge:bool}`. Pace/gap read from
  `PHYS.NIGHT_PACE`/`PHYS.NIGHT_GAP` after Task 6 (the only place the read site
  changes — flagged in Task 6 Step 1).
- **No placeholders:** every code step shows complete code; every verification is
  a concrete runnable script with an expected result. The debug hook is added in
  Task 1 and explicitly removed + grep-verified in Task 6.
- **Ordering safety:** T1 (inert state) → T2 (front moves, harmless/invisible, old
  losses intact) → T3 (nightfall callable, not yet wired to losses) → T4 (losses
  rewired, old counters removed) → T5 (visual) → T6 (tune/clean/ship). Each leaves
  the game playable.
```
