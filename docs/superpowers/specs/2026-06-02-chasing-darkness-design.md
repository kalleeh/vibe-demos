# Chasing Darkness — design

**Date:** 2026-06-02
**Demo:** `tinywings/` ("Sketchwings")
**Goal:** Introduce a pursuing "night" that catches the bird when it's too slow, with a unified nightfall animation that plays for every loss. Consolidate the three flaky "stopped" loss triggers into one robust detector.

## Context

This is sub-project #1 of a four-part feature set (see below). It is self-contained
and depends on nothing else. Today the day cycle (`dayDurMs = 45_000`) is purely
cosmetic — the palette advances `dawn→noon→dusk→night` and the terrain reseeds
mid-flight, with no loss attached. Actual losses fire from three overlapping
stopwatches with different flavor text:

- `stuckMs` → `"the wind has settled"` (signed `vx < 60` for >1s)
- `noProgressMs` → `"out of speed"` (no ≥10px forward gain in 1.2s)
- `backslideMs` → `"shoved back"` (≥60px below high-water mark for >250ms)

These have been hard to tune consistently. This work replaces them.

## Decisions locked in brainstorming

- **Chase driver:** speed-relative. The night advances at a steady world pace;
  the bird's speed is what outruns it.
- **Loss model:** TWO independent clean paths — (1) a single consolidated
  "stopped" detector = instant loss, replacing the three counters; (2) the
  night-front = separate slow-pressure loss (moving but too slow over distance).
- **Pressure during a good run:** distant ambient threat — a skilled run keeps
  the front off the left edge; it only becomes visible/scary when you slow.
- **Loss feel:** engulf → settle (stars) → end card. Same sequence for every
  death, so every loss reads as "the night caught you."
- **On a stop:** the front SURGES forward to meet the bird, so even the instant
  stop-loss looks like the darkness catching you.
- **Visual:** "ink wash wall" (Option A from the mockup) — a soft watercolour
  darkness bleeding from the left. HARD REQUIREMENT: the swell and blots move
  **seamlessly** (continuous flowing motion), never teleporting/popping.

## Section 1 — Night-front model

A world-space position `G.nightX` tracks the leading edge of the darkness, in the
same coordinate space as the bird's `G.bx` (px). Distance scale reuses the
existing `(bx - 200) / 14` px-per-metre. The gap is `G.bx - G.nightX`.

- **Advance:** each tick, `nightX += NIGHT_PACE * dt`. `NIGHT_PACE` is a steady
  world-speed tuned below a competent cruise (start ~210 px/s; spawn `vx`=420,
  `LIFT_VMIN`=180, a good run sits 350–700, `VMAX`=1100).
- **Spawn gap:** at each run start, `nightX = bx - NIGHT_START_GAP`
  (~1200px ≈ 85m) for immediate breathing room.
- **Catch:** when `bx - nightX <= 0`, trigger the nightfall sequence (Section 3).
- **No rubber-banding** in normal flight (steady, learnable). The only
  non-steady move is the stop-surge (Section 3).

Independent of terrain/day/world, so it composes with the later Worlds work
(a world just supplies a different `NIGHT_PACE`).

## Section 2 — Loss model (two paths)

**Path 1 — Stopped (consolidated, instant).** One detector replaces all three
counters. Track the bird's furthest world-x (`G.maxBx`) and the wall-clock time
it last advanced by a meaningful amount (`G.lastProgressAt`). If the bird fails
to gain >= `PROGRESS_MIN` px (≈12) within `STOP_MS` (≈1300ms), it is stopped →
loss. Keying on net forward progress from the high-water mark catches all three
old cases at once: frozen (no gain), crawling-in-place (jitter under threshold),
and backsliding (max-x not advancing). Still gated by the existing `lossArmed`
(no loss during tutorial or the post-tutorial grace window).

**Path 2 — Night-front (slow pressure).** Per Section 1: moving but too slowly
→ steady front closes → `bx - nightX <= 0` → loss. Covers "moving but not fast
enough," which the stop-detector alone does not.

**Unified outcome:** both paths call the same `triggerNightfall(cause)`
(Section 3). The four old reason-strings collapse into one (e.g. "the night
caught you"). `endRun`'s distance/perfect/best/leaderboard logic is untouched;
it is invoked at the end of the nightfall sequence rather than directly.

**Removed:** `G.stuckMs`, `G.noProgressMs`, `G.backslideMs`, `G.stuckCheckBx`
and their three `endRun(...)` calls.

## Section 3 — Nightfall sequence (animation + state)

**State:** `G.nightfall = { active: false, startedAt: 0, phase: "engulf" }`,
`phase ∈ {engulf, settle, done}`. Single entry point `triggerNightfall(cause)`
that both loss paths call (replaces direct `endRun` calls in the loss checks).

**Sequence (~1.6s total):**
1. **Surge (Path 1 only):** on a stop, lerp `nightX` toward `bx` over ~250ms (or
   snap `NIGHT_PACE` up hard) so the front rushes in. Path 2 = no-op (already there).
2. **Engulf (~0.8–1.0s):** the ink wash sweeps from its position across the whole
   screen, eased (accelerates over the bird then floods the rest). Bird keeps its
   last motion briefly, then is overtaken. World shifts to the night palette.
3. **Settle (~0.5s):** full night, a beat of stillness, stars fade in.
4. **Done:** call the existing `endRun(cause)` → end card fades up as today.

**Gameplay freeze:** while `G.nightfall.active`, `physicsStep` early-returns (no
new losses stack); the render loop keeps running to draw the animation.

**Reduced-motion:** `prefers-reduced-motion` collapses engulf+settle into a
~300ms cross-fade to night, then the card. No sweeping motion.

**Ink visual (Option A, animated):** a left-anchored canvas layer whose right
edge sits at `screenX(nightX)`. Seamless motion (hard requirement):
- Feathered gradient edge + low-frequency flowing-noise displacement on the
  boundary (value-noise sampled with a continuously advancing time offset — the
  edge undulates, never jumps).
- Blots are a fixed particle set with gentle drift velocities + sine bob,
  advected with `nightX`; they ease, never teleport. Stars inside fade in by depth.
- During normal play the same layer renders at the current `nightX`, so as the
  front nears, more ink naturally fills the left of the screen.

## Section 4 — HUD, day cycle, files, testing

**Day cycle / palette:** the cosmetic 45s palette drift STAYS (ambient
time-of-day), but no longer implies loss. The ink layer renders on top of any
palette (you can be at "noon" with darkness creeping in at the left). Per-world
theming is the later Worlds sub-project, out of scope here.

**HUD:** `DIST` / `BEST` / `DAY` unchanged. Add a subtle proximity cue: when the
gap drops below ~30m, the left-edge darkening/vignette intensifies (mostly the
ink layer filling in, plus optionally a faint vignette). No new HUD widget;
keeps the calm tone.

**File structure:** all in `tinywings/index.html` (single-file demo convention).
- Constants near `PHYS`: `NIGHT_PACE`, `NIGHT_START_GAP`, `PROGRESS_MIN`,
  `STOP_MS`, surge params.
- `G` state: `nightX`, `maxBx`, `lastProgressAt`, `nightfall{}`. Reset in `startGame`.
- `updateNight(dt)` + `checkStopped(dt)` called from `physicsStep`;
  `triggerNightfall(cause)`; `drawNight()` in the render loop.
- Remove the three old counters and their `endRun` calls.
- Add the new constants to the `PHYS` tuner panel for live dial-in.

**SW:** bump `vibe-tinywings-v42 → v43`.

**Cleanup:** delete the temporary `scratch-night-front.html` (the Pages-hosted
style mockup) from the repo root as part of this work — it was only for phone
review of the visual direction.

**Testing (no test runner — static + headless Playwright per the playtest-driver
memory; temporary `window.__TW_DEBUG_G = G` hook, removed before commit):**
- Stop-detector: drive to a stall → single loss within ~STOP_MS, nightfall plays,
  end card shows. Verify the three old reasons no longer fire.
- Night pace: scripted fast run keeps `gap` growing (front off-screen); slow/idle
  run shrinks `gap` to <=0 → nightfall.
- Surge: hard stop → front reaches bird quickly (engulf within the sequence window).
- Reduced-motion: emulate `prefers-reduced-motion` → quick cross-fade path taken.
- Smoke: no console errors; debug hook removed; commit only tinywings files.

## Out of scope — the other three sub-projects (build later, in order)

These were explicitly deferred and MUST be remembered as follow-on work:

1. **Worlds** — terrain + theme change as you progress (after N days the world
   changes). Constraint: World 1 stays gentle/regular (onboarding), but later
   worlds must have much more **uneven hill arrival** — varied spacing/amplitude,
   not one repeated sine, while staying playable.
2. **Unlockable birds** — different bird sprites unlocked by achievements (worlds
   progress automatically; birds are earned).
3. **Achievements + stats on the PocketBase backend** — fun achievements and more
   tracked stats beyond distance (longest airborne distance, longest airborne
   time, etc.). Extends the existing `leaderboard` backend.
```
