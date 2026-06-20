# Contraption Lab — Polish: Sound + Sprite Animation + Per-theme Art design

**Date:** 2026-06-20
**Slug:** `contraption-lab` (final roadmap items; built after the editor ships)
**Builds on:** the sprite system (`js/sprites.js`, `js/render.js`), `js/theme.js`, `js/engine.js`.

## Summary

The three remaining roadmap polish items, all client-only (no backend), as one spec:
1. **Sound** — a tiny WebAudio SFX layer (place, run, win, collision/bounce, explosion) with a
   persistent mute toggle; honors `prefers-reduced-motion`/quiet by defaulting sensibly.
2. **Sprite animation** — genuinely-spinning parts (gears, fan, pinwheel) visibly rotate during
   Run, by spinning their static sprite at a part-defined rate (no multi-frame art needed).
3. **Per-theme bespoke sprites** — populate the existing `themeOverrides` hook for a few hero
   parts in 1–2 themes as a showcase that the mechanism works end-to-end.

All three are independent and individually shippable; each must degrade to a no-op (no sound
file? silent. no override art? shared sprite. reduced-motion? no spin).

## Section 1 — Sound (WebAudio SFX)

`js/sound.js` — a minimal synthesized-SFX module (NO audio files to keep it static/zero-asset):
- Lazily creates one `AudioContext` on first user gesture (autoplay-policy safe).
- `sfx(name)` plays a short synthesized sound via oscillator+gain envelopes: `place` (soft tick),
  `run` (rising blip), `win` (a little 3-note arpeggio), `bounce` (short sine pop, pitch by
  impact speed), `explode` (noise burst for TNT). All ≤300ms, gentle.
- `setMuted(bool)` / `isMuted()` persisted to `localStorage["cl.muted"]`. A 🔊/🔇 toggle in the
  top bar. Default: ON, but never plays before a user gesture.
- Wiring: `main.js` calls `sfx("place")` on placement, `sfx("run")` on Run, `sfx("win")` in
  onWin; `engine.js` emits collision events (Matter `collisionStart`) that `main.js` maps to
  `bounce` (throttled, min interval + speed threshold so it's not a machine-gun) and `explode`
  on TNT detonation. The engine stays pure (no audio import); it exposes an optional
  `sim.onEvent` callback that main.js sets — engine never hard-depends on sound.
- Resilience: if `AudioContext` is unavailable or a node throws, `sfx` is a silent no-op.

## Section 2 — Sprite animation (spinning parts)

Parts whose real behavior is rotation should *look* like they spin. Rather than multi-frame art,
spin the existing static sprite:
- `sprites.js` registry entries gain an optional `spin` field (radians/sec) for `gear`, `gears`,
  `fan`, `pinwheel`. (fan blades, gear teeth, pinwheel vanes.)
- `render.js`: when a part has `spin` AND the sim is running, add an accumulating render-angle
  (time-based) to `body.angle` when drawing its sprite — purely visual, never touches the body.
  For parts that already physically rotate (gears are dynamic, pinwheel pivots), `spin` is a
  *visual boost* only where the physical rotation is too subtle; gate it so we don't double-spin
  (a part that's meaningfully rotating physically uses its real angle; truly-static-but-should-
  -look-spinning parts like the fan get the synthetic spin).
- Honors `prefers-reduced-motion`: no synthetic spin (physical rotation still shows).
- The render loop needs a time delta; `render.js` already draws per rAF — pass `opts.now`
  (a timestamp) from main.js's tick so spin is deterministic and pausable (no spin when not
  running).

## Section 3 — Per-theme bespoke sprites (showcase the hook)

Prove the `themeOverrides` mechanism with real art for a few **hero parts** in the two most
distinct themes:
- Generate per-theme variants for ~3 hero parts (ball, fan, goal) in **Neon** (glowing) and
  **Blueprint** (line-art/blueprint-ink), via the same SD3.5 → remove_background → make-sprite
  pipeline, committed to `assets/parts/<theme>/<part>.png`.
- Populate `SPRITES[part].themeOverrides = { neon: "...", blueprint: "..." }`.
- `resolveSprite(part, themeId)` already applies the override (built + tested in the sprite
  phase); `preloadSprites(themeId)` already loads the resolved src per theme. So this is
  almost entirely an *asset* task — the code path exists and is tested.
- SW: add the new per-theme PNGs to the cache shell; bump cache version.
- Scope guard: only ~3 parts × 2 themes = ~6 override sprites — a deliberate showcase, not the
  full N×4 matrix (the spec explicitly rejected full per-theme art for roster-growth reasons).

## Section 4 — Error handling & testing

- **Sound:** missing/blocked AudioContext → silent no-op; mute persists; collision SFX throttled.
- **Animation:** reduced-motion → no synthetic spin; spin never affects physics (render-only,
  same guarantee as the sprite system).
- **Per-theme art:** a missing override PNG → falls back to the shared sprite (the existing
  getImage→vector chain); nothing breaks.
- **Testing:**
  - Pure `?test`: `sound.js` mute persistence + name→params mapping returns sane values without
    a real AudioContext (guarded); `sprites.js` resolveSprite still returns the override when a
    themeOverride is present (already covered; extend with the populated entries); a spin-angle
    helper (time → angle) is pure and tested.
  - Real-browser QA (Playwright): toggling mute; a Run produces no console errors with audio
    active; spinning parts visibly change render-angle (sample two frames); switching to Neon/
    Blueprint loads the override sprites (getImage on the override src is non-null); 0 errors.
- **Physics invariance:** sound + animation + per-theme art are all render/UX-only; the
  solvability sweep (now 14 levels) must still pass unchanged.

## Build order

Sound → Animation → Per-theme art (independent; this order ships the most-felt item first).
Each commits + is verified on its own; the whole spec merges/deploys together after QA.
