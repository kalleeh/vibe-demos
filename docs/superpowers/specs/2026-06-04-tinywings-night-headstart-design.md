# Tinywings — tighten the chasing-night opening (head start)

**Date:** 2026-06-04
**Demo:** `tinywings/`
**Status:** approved, ready for implementation plan

## Problem

The chasing-night front (shipped 2026-06-02, the lethal advancing darkness) feels
**too forgiving** for a competent player. Because the night advances at a flat pace
(`PHYS.NIGHT_PACE` = 210 px/s) while a competent cruise is ~420+ px/s, once a good
flight gets going the gap grows without bound and the night stops mattering — it only
ever threatens a stall. The one phase where a smaller head start *does* bite is the
**opening**: a 1200px head start means the night starts far away and the first several
seconds carry no stakes.

We want more pressure in the early game, and a value we can keep tuning ourselves.

## Decision

Sharpen the opening by **lowering the head start** and **widening the slider range** so
the existing live tuner can reach tighter values. We deliberately do NOT touch night
pace, the stall/stop-detector grace, or add an acceleration ramp — those were other
levers we set aside.

The `NIGHT_GAP` knob is *already* a live tuner slider ("night · head start") that
persists to `localStorage` (`sketchwings.phys`) and exports via the panel's "copy"
button. So the tune-and-report workflow already works; we only adjust the floor and the
shipped default.

## Changes

All in `tinywings/index.html`, plus a SW cache bump.

| Knob | Location | Now | After |
|---|---|---|---|
| `NIGHT_GAP` slider `min` | `TUNER_SCHEMA` (~`:1869`) | 400 | **100** |
| `NIGHT_GAP` slider `max` | `TUNER_SCHEMA` | 2400 | 2400 (unchanged) |
| `NIGHT_GAP` slider `step` | `TUNER_SCHEMA` | 20 | 20 (unchanged) |
| `PHYS_DEFAULTS.NIGHT_GAP` | `PHYS_DEFAULTS` (~`:1832`) | 1200 | **600** |
| SW cache name | `tinywings/sw.js:2` | `vibe-tinywings-v44` | `vibe-tinywings-v45` |

No other code changes. The spawn line `G.nightX = 200 - PHYS.NIGHT_GAP`
(`startGame`, ~`:1445`) already derives from the knob.

## Why this is safe

- **No instant-death risk at gap=100.** The 800ms spawn warmup plus the post-tutorial
  grace window in the loss-check block (~`:2288`) means neither loss path arms before
  the bird has accelerated away from its spawn velocity (`vx=420`). A 100px floor cannot
  produce an unfair catch on a tricky opening slope.
- **Single source of truth.** Spawn position reads `PHYS.NIGHT_GAP`; changing the
  default and slider floor is the entire behavioral change.
- **Tuning workflow unchanged.** Slider persists and exports as before; lowering the
  floor just lets it reach the values worth testing.

## Out of scope

- Night pace (stays flat 210 px/s).
- Stall / stop-detector grace timing (the roadmap's "too forgiving" stall note remains a
  future item — see [[project-tinywings-roadmap]]).
- Any per-day or per-run acceleration ramp / scaling head start.

## Verification

1. `node --check` is not applicable (inline HTML script); instead confirm the page loads
   and a run starts via the headless Playwright playtest driver
   (see [[project-tinywings-playtest-driver]]).
2. Open the ⚙ tuner panel and confirm "night · head start" now drags down to 100.
3. Confirm a fresh run spawns with the night visibly closer than before.
4. SW cache bumped to `v45` so the gameplay change propagates to installed PWAs.
