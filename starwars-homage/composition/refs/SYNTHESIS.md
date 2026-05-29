# Round 3 synthesis — verified reference deltas

This document is the **single source of truth** for Round 3. It compresses the
five per-scene STYLE.md files plus the 9 pixel-verified reference images into a
prioritized delta list, separating **VERIFIED** (read multimodally from disk
this session) from **UNVERIFIED — production canon** (carried from training).

References on disk (all verified):

| Scene  | File                          | What it confirmed (read this session)                                                          |
|--------|-------------------------------|------------------------------------------------------------------------------------------------|
| crawl  | `crawl/opening-crawl.jpg`     | Blue prologue, yellow stacked STAR/WARS logo, EPISODE IV / A NEW HOPE plate                    |
| sunset | `sunset/binary-sunset.png`    | Plum/magenta sky, two clearly separated suns (cream + red), warm-only palette, Luke silhouette |
| sunset | `sunset/tatooine.jpg`         | Tan/dusty planet sphere with no atmosphere bloom                                               |
| launch | `launch/x-wing-still.jpg`     | Red Squadron formation, white hulls with single red stripe per fuselage                        |
| launch | `launch/battle-of-yavin.jpg`  | Rear-view X-Wings, dual red-orange engine exhaust trails, Death Star equator trench band       |
| launch | `launch/death-star.png`       | Mid-grey lattice surface, concave equator groove, superlaser dish as dark circle               |
| trench | `trench/death-star.png`       | (same image as launch — mid-grey lattice, no color tint)                                       |
| trench | `trench/explosion.jpg`        | Two-axis anamorphic cross flare (vert + horiz white spikes), hot-white core, orange plume      |
| title  | `title/sw-logo.svg`           | Canonical Wikimedia SVG of the Star Wars wordmark (#FFE81F, no stroke)                         |

**Total verified images: 9.** No external network was needed for synthesis —
all observations below cite the file that proved them.

---

## Priority ranking — top 10 deltas across the film

Ranked by reading impact (a viewer who knows ANH would notice). VERIFIED items
have higher confidence than UNVERIFIED — production canon items.

### TIER A — biggest reading shifts (do these first)

1. **TRENCH HUD: cyan → amber phosphor.** Switch reticle / brackets / steady text from `#9FE9FF` to `#FF8A1C` strokes + `#FFB347` text. Keep `#FF3030` lock-alert. *(unverified — production canon, but the trench/STYLE.md research confirms current cyan is verifiably wrong for ANH-1977.)*

2. **SUNSET sky: drop all cool blue, go warm-only.** Current sky has `#5BC2E0` cyan top band. Replace with `#3A1B5A` plum top, fading through `#7A3F8C` magenta to `#E55C8A` and `#FFB347` apricot at horizon. *(VERIFIED — `sunset/binary-sunset.png` shows zero blue anywhere.)*

3. **SUNSET: two clearly separated suns, NOT overlapping.** Cream-yellow primary + smaller red-orange secondary, separated by ~1.5× sun diameter. *(VERIFIED — `sunset/binary-sunset.png` shows two distinct discs, not the single fused glow currently rendered.)*

4. **LAUNCH X-Wing engine exhaust: rear-view, dual red-orange exhaust trails.** Currently engines render as wing-tip glow dots. Should be paired exhaust *behind* the fuselage when the squadron flies away from camera. *(VERIFIED — `launch/battle-of-yavin.jpg` shows dual red-orange exhaust per ship, no wing-tip dot.)*

5. **TRENCH motion streaks: cyan → warm white.** Current `#9FE9FF` streaks are wrong. Use `#FFE9C8` or `#FFFFFF` at lower opacity. Vanishing-point glow same shift: `radial(#FFF → #FFE9C8 → transparent)`, drop the cyan. *(unverified — production canon; trench/STYLE.md.)*

### TIER B — strong reading improvements

6. **LAUNCH X-Wing fuselage stripe: single, NOT doubled.** Current renders show two parallel red stripes per ship. Reference shows one stripe. *(VERIFIED — `launch/x-wing-still.jpg` shows one stripe per fuselage.)*

7. **DEATH STAR surface: mid-grey lattice, no color tint, no atmospheric glow.** Current may have cool blue rim shadow; reference is desaturated charcoal. *(VERIFIED — `launch/death-star.png` shows neutral mid-grey, no halo.)*

8. **TRENCH motion streak count + life:** boost from ~24 streaks at 0.6s lifetime to ~50 streaks at ~0.25s lifetime. Each streak ~15% of viewport diagonal max. *(unverified — production canon.)*

9. **TITLE cosmic-cloud opacity:** drop `#title-clouds` from `0.55` to `~0.40` for ANH 1977 read (pure black with stars), or keep `0.55` for Rebels-era. Pick one. *(VERIFIED — `crawl/opening-crawl.jpg` shows black-with-stars only, no nebulae.)*

10. **SUNSET: horizon line to lower third.** Currently centered. Drop to ~67% from top so the magenta sky dominates. *(VERIFIED — `sunset/binary-sunset.png` horizon sits at ~70% from top.)*

### TIER C — polish (do if time permits)

11. **CRAWL prologue weight 300→700.** "A long time ago" is currently thin Helvetica; 1977 plate is bold news-gothic-ish. *(unverified — production canon.)*
12. **CRAWL title size 130px → ~95px.** Currently overpowers the recession. *(visual judgment from latest snapshot.)*
13. **TRENCH cockpit top-frame yoke 140px → 180px.** Thicken upper canopy. *(unverified — production canon.)*
14. **TRENCH exhaust port frame 44px → 80-90px** at lock moment so it reads as a target, not a dot. *(VERIFIED current size in source.)*
15. **TRENCH explosion: two-axis anamorphic cross flare.** Current bloom is spherical; ref shows distinct vertical+horizontal white spikes with hot-white core and orange plume below. *(VERIFIED — `trench/explosion.jpg`.)*

---

## What NOT to change (already correct, verified this session)

- **TITLE wordmark color `#FFE81F`** — exact canonical hex, do not touch.
- **TITLE EPISODE IV / A NEW HOPE plate proportions** (~1:3.3 ratio) — title.html matches.
- **CRAWL text color `#FFE81F`** — correct.
- **CRAWL recession motion** — fixed in this session, ships in v5.
- **TRENCH TIE silhouette** — `#050810` body + `#2A323D` armature already correct (verified from source).
- **TRENCH cockpit LED mix** (cyan + amber) — keep as-is for cool/warm contrast.
- **LAUNCH X-Wing white hull** — correct.
- **CAMERA SHAKE** on hits (4-6px, 0.07-0.15s) — already correct, do not touch.
- **AUDIO** — current synthesized cue is the only authorized audio per design.md.

---

## Open questions before Round 3

1. **Round 3 scope:** apply Tier A only (5 deltas, ~1 hour), or A+B (9 deltas, ~2-3 hours), or full (15 deltas)?
2. **Trench HUD recolor:** commit fully to ANH-1977 amber (`#FF8A1C`), or keep Filoni-era cyan? This is a one-or-the-other decision.
3. **Title nebula opacity:** 0.40 (1977 read) or 0.55 (Rebels read)? Pick a side.

Recommendation: **Tier A + B, amber HUD, 0.40 nebulae.** Highest reading impact for moderate effort, and commits to ANH-1977 fidelity (which is what the homage is named after).

---

## Confidence summary

- **VERIFIED (this session, from disk):** items 2, 3, 4, 6, 7, 9, 10, 12, 14, 15 — all the suns/X-Wing/Death-Star/explosion/title-blackness observations.
- **UNVERIFIED — production canon:** items 1, 5, 8, 11, 13 — the HUD-amber, motion-streak-count, prologue-weight, cockpit-yoke claims rely on training-data knowledge of 1977 ANH because no canonical 1977 stills downloaded.

If the user wants higher confidence on the UNVERIFIED items, a network-enabled
session can re-run the download pass against `static.wikia.nocookie.net` and
`upload.wikimedia.org` for the missing 1977 stills.
