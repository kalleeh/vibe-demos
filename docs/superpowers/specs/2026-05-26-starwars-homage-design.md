# `starwars-homage` — A New Hope, in Four Beats

**Status:** Design approved 2026-05-26
**Slug:** `starwars-homage`
**Display title (works index):** `A New *Hope*` (italic on "Hope")
**Type:** Cinematic mini-movie (~38s MP4) authored with HyperFrames, embedded in a thin demo shell.

---

## 1. Concept

A ~38-second cinematic homage to *Star Wars: Episode IV — A New Hope*, rendered with HyperFrames and shipped as an MP4 on the `starwars-homage/` demo page.

The demo page itself is a thin shell: editorial landing card with title and play button, fullscreen video player, replay button, and a "made with HyperFrames" credit. The HyperFrames composition lives at `starwars-homage/composition/` (committed for transparency, not served as the demo's entry point); only the rendered MP4 + the shell HTML are part of the live demo experience.

Rationale for embedding video instead of building interactive: the user wanted to exercise the HyperFrames stack as much as possible, and the cinematic crawl-driven aesthetic is fundamentally a *film* — interactivity would dilute it. This is the first vibe-demo where the artifact is a rendered video rather than a live page.

## 2. IP framing

The user opted to push close to canon (names, music, the iconic title treatment) rather than do a fully sanitized homage. After flagging the public-hosting risk surface, we settled on this compromise — close enough to be unmistakable, distant enough to be defensible:

- **Names from canon:** allowed (Luke, Vader, Tatooine, etc., used in our own prose).
- **The actual A New Hope opening crawl text:** allowed (it's the most recognisable single piece of copy in cinema; Lucasfilm has historically not pursued fan reproductions of it).
- **The iconic STAR WARS title treatment:** allowed, but rendered with the Star Jedi-style font ourselves — we type the words "STAR WARS" in the right typeface rather than embedding a raster of the Lucasfilm-owned logo image.
- **Star Jedi / SF Distant Galaxy fonts:** allowed (free fan-made clones of the iconic crawl typeface, on dafont.com for 20+ years, OFL/CC licensed variants chosen). Body type for the prologue card uses the Star Jedi family's "Special Edition" / "Outline" companion or any News Gothic free clone shipped under OFL.
- **John Williams' score:** **NOT bundled in the public repo.** The page references `audio.mp3`, and the file committed to the repo is a public-domain orchestral cue that gestures at the mood. A `audio.local.mp3` path is gitignored so the user can drop a Williams track in locally for personal viewing without risking a takedown.
- **Original ship silhouettes:** the X-wing-style fighters in scenes 3 and 4 are stylized SVG silhouettes inspired by — not traced from — the canonical designs.
- **No Lucasfilm logo, no Disney logo, no trademarked badge artwork** as raster assets on the demo page or in the composition.

## 3. Scene rhythm (~38s)

Pattern: **HOLD–HOLD–FAST–FAST–RELEASE.** First half breathes (read the crawl, watch the suns set); second half accelerates into the trench; release on a held title.

| # | Scene | Length | Energy | Tech |
|---|---|---|---|---|
| 1 | The Crawl | 14s | held / nostalgic | CSS 3D perspective + SVG starfield |
| 2 | Tatooine Binary Sunset | 8s | held / mood | SVG silhouettes + CSS gradients |
| 3 | X-Wing Launch | 6s | kinetic / build | SVG + GSAP MotionPath |
| 4 | Trench Run | 8s | peak / climax | WebGL shader + SVG overlay |
| — | Title Card | 2s | release | CSS over parallax starfield |

Transitions: **crossfade through black** between every scene (~0.5s per transition; durations above are scene-content time, transition time is additional).

## 4. Each scene in detail

### Scene 1 — The Crawl (14s)

- Black background with a parallax SVG starfield (200 stars, seeded `mulberry32`, slow drift over the full duration).
- Above the crawl, the iconic prologue card: *"A long time ago in a galaxy far, far away…"* in blue-grey `#4BD5EE`. Fades in at 0.5s, holds 4s, fades out at 4.5–5s before the crawl appears.
- Yellow `#FFE81F` crawl text in a Star Jedi-style font (local `.woff2`), tilted with `transform: perspective(400px) rotateX(25deg)`, animated `translateY` from `+800px` to `-2400px` over the remaining ~9s. Three paragraphs of *A New Hope*'s actual opening crawl text.
- Music swells if audio track is present (silent fallback OK; the public-domain cue cross-faded in works fine here).

### Scene 2 — Binary Sunset (8s)

Pure SVG + CSS. The original sunset shot is famously composed flat, so no 3D is needed.

- Vertical sky gradient from deep apricot (top) through dusty violet (mid) to warm rust (horizon).
- Two suns as SVG `<circle>` elements with radial-gradient halos: one large warm `#FFB347`, one smaller cooler `#FFD27A`, low on the horizon, slightly offset.
- Silhouette dune line as a single SVG path running across the lower third.
- Silhouette figure (a young farm-hand, clear hood-and-tunic outline) as an SVG path placed right-of-center, looking at the suns.
- GSAP slowly drifts the suns down ~6px and tints the sky one stop redder over the 8s.
- Heat-haze stripe via a CSS `filter: url(#displaceX)` SVG filter on a thin horizon band.
- Crossfade to black starts at 7s.

### Scene 3 — X-Wing Launch (6s)

SVG ships drawn as flat silhouettes, animated along GSAP `MotionPathPlugin` splines that arc from deep frame past camera.

- Hangar interior briefly visible at the start: parallax SVG bands forming ribbed hangar walls, with a vignette mouth opening up to space.
- Four X-wing-style fighters launch in a tight V formation, streaking past camera over ~3s.
- Engine glow is a CSS `box-shadow` cyan-white bloom (`#9FE9FF`) that grows along the path.
- Trail = `clip-path` stripe revealing behind each ship as it travels.
- Final beat: ships exit upper-right, last frame holds black starfield for 0.5s before crossfade to scene 4.

### Scene 4 — Trench Run (8s)

The technically interesting scene. Two layers stacked via `data-track-index`:

**Layer A — WebGL shader (background, full-frame):**
- GLSL fragment shader on a tiny self-contained `<canvas>` clip, per HyperFrames' shader technique pattern.
- Generates a procedural trench surface (greebles via box-fold or repeated SDF noise) scrolling downward at the camera as if flying along it.
- Single uniform `uTrenchScroll` is a GSAP-tweened scalar value; the framework's seek-driven capture sets it deterministically per frame. **No `requestAnimationFrame` deltas, no `Date.now()`, no `Math.random()` inside the shader code path** — random offsets are seeded with a constant.
- Adapted from a public Shadertoy reference (Inigo Quilez "Death Star surface" / similar SDF trench shaders).

**Layer B — SVG overlay (foreground):**
- Cockpit canopy frame as SVG paths around the edges of the frame.
- HUD reticle centered, with a slow lock-on animation that culminates in the final 1s.
- One TIE-style pursuer behind the cockpit, occasionally firing red `#FF3030` laser bolts that streak past camera.
- Speed lines as short SVG line bursts on each side; mild camera shake via GSAP wobble on a wrapper transform; brief screen-flash whites on near-misses.
- Final beat (~7.5–8s): the reticle locks on, the screen flashes white for 4 frames, hard cut into the title card.

### Title card (2s)

- Black screen, starfield drifts back in (parallax SVG, lighter density than scene 1).
- Title `A New Hope` in editorial Fraunces type (italic on "Hope"), fades up centered.
- Small line beneath: `an homage · vibe-demos`.
- Holds 2s, then end.

## 5. Architecture & files

```
starwars-homage/
├── index.html              ← thin demo shell (PWA, video player)
├── manifest.webmanifest    ← PWA manifest
├── icon.svg                ← demo icon (a small yellow tilted glyph or starfield mark)
├── sw.js                   ← per-demo SW (cache name vibe-starwars-homage-v1)
├── poster.jpg              ← video poster frame
├── film.mp4                ← rendered HyperFrames output (committed)
├── audio.mp3               ← public-domain orchestral cue (committed; gitignored Williams track replaces locally)
└── composition/            ← HyperFrames project (committed for transparency, NOT served)
    ├── index.html          ← root composition (1920x1080, 38s)
    ├── package.json
    ├── design.md           ← brand: yellow #FFE81F, blue-grey #4BD5EE, black, Star Jedi
    ├── fonts/
    │   ├── star-jedi.woff2
    │   ├── star-jedi.LICENSE
    │   └── (free News Gothic clone for the prologue card body, OFL-licensed)
    └── compositions/
        ├── crawl.html      ← Scene 1
        ├── sunset.html     ← Scene 2
        ├── launch.html     ← Scene 3
        ├── trench.html     ← Scene 4
        └── title.html      ← Title card
```

### The demo shell (`starwars-homage/index.html`)

Small page following the vibe-demos editorial register at rest, going black during play:

- **Idle state:** cream paper or starry-night gradient hybrid background, big editorial title `A New *Hope*`, one-line subtitle, large play button overlaying the poster frame, `<video>` element hidden.
- **Playing state:** body background goes black, video fills the viewport, controls auto-hide.
- **Ended state:** replay button, "made with HyperFrames" credit, link back to the works index.
- **Reduced-motion (`prefers-reduced-motion: reduce`):** poster-only mode, no autoplay; user must explicitly hit play. The demo never auto-plays the cinematic.
- **PWA:** per-demo manifest + SW per CLAUDE.md PWA shell pattern, cache name `vibe-starwars-homage-v1`, network-first for HTML, cache-first for the MP4 + audio + fonts.

### The HyperFrames composition (`starwars-homage/composition/`)

A standalone HyperFrames project. Root `index.html` defines the 38s timeline at 1920×1080, wires each scene as a sub-composition via `data-composition-src`, and orchestrates the inter-scene crossfades.

Per HyperFrames discipline:

- All timelines `{ paused: true }`, registered to `window.__timelines["<id>"]`.
- Every scene uses entrance animations only; transitions handle exits (no `gsap.to(opacity: 0)` on outgoing scene content, except the very last scene).
- All randomness seeded via `mulberry32`.
- No `Math.random`, `Date.now`, or `requestAnimationFrame`-driven state.
- All elements positioned at their hero-frame layout in CSS first, then `gsap.from()` for entrances.

## 6. Workflow

**Authoring loop:**

```bash
cd starwars-homage/composition
npx hyperframes preview        # live preview
npx hyperframes lint           # per-scene as we build
npx hyperframes inspect        # visual layout audit, hero-frame samples
```

**Final render:**

```bash
npx hyperframes render --output ../film.mp4 --quality medium
```

The rendered `film.mp4` is committed to the repo so GitHub Pages serves it directly — no build step at deploy. Aimed file size: 5–15 MB at 1080p, 38s. If it lands above 15 MB, drop to `--quality low` or trim crawl duration.

**After rendering:**
- Capture poster frame (snapshot at title-card moment): `npx hyperframes snapshot --at 36 --out ../poster.jpg`.
- Update root `index.html` works index per CLAUDE.md maintenance contract: add the row, increment the count, add to the `labels` map.
- Update `README.md` "Live demos" section.
- Mark IDEAS.md with a new entry (or note this as an unscheduled addition).

## 7. Risks & open questions

- **Shader determinism (highest risk).** HyperFrames seek-driven capture requires the trench shader to read its frame state from a GSAP-tweened uniform, not from `gl-time` or `Date.now()`. Worth a small spike on scene 4 *before* committing to the rest, since if the shader pattern doesn't pin down it forces a fallback to all-SVG trench (doable but less impressive).
- **Font licensing.** Star Jedi has multiple variants — pick an OFL/CC0-compatible one and ship the LICENSE file alongside.
- **Audio file size.** A 38s orchestral MP3 at 192kbps is ~900KB. Fine. If we layer multiple cues, watch the budget.
- **MP4 size.** Already covered above; mitigation is `--quality medium` and short scenes.
- **Scope.** Estimated 2 sessions:
  - **Session 1:** Demo shell + scaffolding, scene 1 (crawl) + scene 2 (sunset) end-to-end, render a 22s draft. Validates the HyperFrames-on-vibe-demos workflow.
  - **Session 2:** Scene 3 (launch) + scene 4 (trench shader) + title + final render + MP4 commit + works-index update.
  - If the trench shader is harder than expected, it's a third session or a graceful fallback.

## 8. Out of scope

- Interactive controls (no piloting the X-wing, no scrubbing through scenes).
- Multiple language versions (the crawl text is English only — Korean subtitle could be added later as a stretch).
- Lightsaber duels, Death Star explosion, throne-room scenes — not in the agreed rhythm.
- Any 3D Three.js work (explicitly chosen out of scope to stay inside HyperFrames idioms).

## 9. Success criteria

- Loads on the public Pages URL at `/starwars-homage/`, reading the demo shell.
- The MP4 plays smoothly on desktop and mobile Safari/Chrome.
- The four-beat rhythm is legible: a viewer who knows *A New Hope* recognises every scene; a viewer who doesn't still reads the arc as cinematic.
- Reduced-motion users see a poster-only state with explicit-play.
- HyperFrames `lint`, `validate`, and `inspect` all pass on the composition.
- File ships in ≤ 2 sessions and the rendered MP4 stays under 15 MB.
