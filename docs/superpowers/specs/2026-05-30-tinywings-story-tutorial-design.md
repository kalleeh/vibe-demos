# Sketchwings — Story Intro + Guided Tutorial + Settings

**Date:** 2026-05-30
**Demo:** `tinywings/` ("Sketchwings")
**Status:** Design approved, ready for implementation plan

## Goal

Give first-time players a short story for *why* the bird glides instead of
flapping, then teach the dive→release→boost mechanic by doing (not by reading a
static legend). Auto-run for first-timers; re-summonable any time from a new
settings panel. Also orient the player to the two HUD readouts — the topbar
minimap and the off-screen bird arrow — exactly when each becomes relevant.

All work lands in the single file `tinywings/index.html` (repo convention: demos
are self-contained). No new game mechanics, terrain, or scoring changes.

## The premise: a heavy little bird

The bird is small and a touch too heavy to keep itself up by flapping, so it
surfs the hills for speed — dive down a slope to gather momentum, release on the
rise to soar on what it borrowed from gravity. This reframes the existing
mechanic as a character trait; it does not change the mechanic.

## Component 1 — Story card (enriched intro panel)

Reuse the existing `.intro-panel` layout (hero image left, copy right, install
accordion below). Changes:

- **Rewrite the copy** around the heavy-little-bird premise. Keep the existing
  kicker style (`A Quiet Glide · 단 한 번의 비행`), Fraunces body, `<em>` accents.
- **Two buttons** replacing the single `begin the day →`:
  - Primary: **`teach me to glide →`** → runs the tutorial (Component 2).
  - Secondary (quieter styling): **`just let me fly`** → skips tutorial, starts
    normal free play.
- **Remove** the static 3-item legend (`tap` / `release` / `tap mid-air`) from
  the card — the tutorial now teaches those live.
- The install accordion is unchanged.

**First-visit gating:** the card auto-shows only when `localStorage` key
`vibe.tinywings.onboarded` is absent. Returning players skip straight to play
(no card). Both buttons, and tutorial completion/skip, set
`vibe.tinywings.onboarded = "1"`.

## Component 2 — Guided tutorial (interactive coachmarks)

When the player chooses "teach me to glide," the game enters a **forgiving learn
mode**, then runs three gated steps and two just-in-time HUD coachmarks.

### Learn mode (can't-fail)
While the tutorial is active:
- The day/night cycle is **paused** so the run cannot time out.
- The **loss/rest conditions are suppressed** so a first-timer cannot crash or
  come to rest mid-lesson.
- `restart`, the gear/settings button, and a **`skip tutorial`** affordance stay
  available so nobody is trapped.

Implementation note: gate the existing end-of-run / night-fall logic behind a
`G.tutorial` (or equivalent) flag rather than adding a parallel loop. Resume the
normal day cycle and loss conditions when the tutorial completes or is skipped.

### The three gated steps
Each step shows one coachmark and advances only when the player performs a
**real** move, detected via the existing state machine — no new physics:

1. **DIVE** — detected when `pitchDown` is held through a downslope (same signal
   the game already uses for diving).
2. **RELEASE** — detected on a real launch off a crest (reuse the existing
   `releasedAtCrest` / launch detection).
3. **BOOST** — detected when the player taps mid-air and spends boost (reuse
   `boostingNow`).

On completion: show a closing caption (e.g. *"that's it — the hills are
yours."*), fade out, set `vibe.tinywings.onboarded`, and resume normal play.

### Coachmark visual
A small cream card (`rgba(244,236,214,…)`, dashed border to match the studio
grammar) holding a **Caveat** one-liner plus an inline **SVG squiggle arrow**
pointing toward the slope/bird. Positioned in the lower-center play zone so it
doesn't cover the topbar HUD. Honors `prefers-reduced-motion` (arrow stops
bobbing; use a static or subtle-fade state).

### Two just-in-time HUD coachmarks (not gated steps)
- **Minimap** — during Step 1, a brief coachmark points up at the topbar
  minimap: *"the strip up top shows the hills ahead — and where your bird is."*
  Auto-dismisses after a few seconds or when Step 1 completes. Tutorial-only.
- **Off-screen arrow** — explains itself the **first time the bird actually
  leaves the viewport**, in either tutorial or normal play, gated by its own
  one-time flag `vibe.tinywings.seenOffscreen`. A Caveat caption appears next to
  the existing chevron wafer (drawn by `drawOffscreenIndicator`): *"that's your
  bird — follow the arrow back down."* Shows once ever, then never again. This
  trigger is used because the arrow only appears when the bird is genuinely
  off-screen and cannot be demoed on cue.

## Component 3 — Settings panel (full consolidation)

The footer drops from four buttons to **`restart` + `⚙` (gear)**.

The gear opens a relabeled version of the existing `.tuner` aside, now titled
**Settings**, containing:

- **`how to play`** — replays the full story card + tutorial on demand (the
  re-summon path). Re-running resets the in-tutorial step state but does NOT
  clear `vibe.tinywings.onboarded` (replays are explicit, not first-visit).
- **`sound`** — the on/off toggle, moved in from the footer.
- **`advanced · physics`** — a collapsed disclosure wrapping the existing tuner
  sliders (`tuneRows`, copy values, reset defaults). Still reachable; out of the
  casual player's way. Collapsed by default.

Existing footer buttons being removed/relocated: `tune · physics` (into the
disclosure), `sound · on` (into the panel). `restart` stays a direct footer
button. The gear button replaces them as the second footer control.

## Data / state summary

| Key | Purpose | Set when |
|-----|---------|----------|
| `vibe.tinywings.onboarded` | First-visit gate for story+tutorial | Either intro button clicked, or tutorial completed/skipped |
| `vibe.tinywings.seenOffscreen` | One-time off-screen-arrow caption | First time the bird leaves the viewport |
| `sketchwings.phys` | (existing) physics tuner values | unchanged |
| `vibe.tinywings.best` | (existing) best distance | unchanged |
| `vibe.tinywings.rotate.ack` | (existing) rotate-hint ack | unchanged |

Transient (in-memory) tutorial state: a `G.tutorial` flag + current step index;
not persisted.

## Accessibility & motion
- Coachmark arrow animation gated by `prefers-reduced-motion: reduce`.
- Tutorial is keyboard-playable: Space/Arrows already drive dive/release, so the
  same gated detection works without pointer input.
- `skip tutorial` is always focusable/visible.
- Settings panel: gear button has an accessible label; the `advanced` disclosure
  uses a real `aria-expanded` toggle.

## Non-goals
- No new game mechanics, terrain generation, physics, or scoring changes.
- No new files — everything in `tinywings/index.html`.
- No changes to the day/night palette cycle beyond pausing it during the
  tutorial.

## Deployment
- Single-file edit to `tinywings/index.html`.
- Bump the demo SW cache (`vibe-tinywings-vNN` → next) so the change propagates.
- No root works-index / README changes (the demo itself isn't being
  added/removed/renamed; only its internal UX changes).
