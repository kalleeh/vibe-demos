# A New Hope — Design

## Mood
Cinematic, nostalgic, dark, kinetic. First half held and contemplative; second half kinetic and tight.

## Palette
- Crawl yellow: `#FFE81F`
- Prologue blue: `#4BD5EE`
- Sunset apricot: `#FFB347`
- Sunset secondary: `#FFD27A`
- Engine cyan: `#9FE9FF`
- Laser red: `#FF3030`
- Void black: `#0A0A0A`
- Star white: `#F5F5F5`

## Typography
- Crawl: `"Star Jedi", "Times New Roman", serif` — embedded via `@font-face` from `fonts/star-jedi.woff2`.
- Prologue card and HUD: `"Helvetica Neue", "Arial", sans-serif`. Body weight, slightly tracked.
- Title card: serif (system fallback acceptable), italic on the focal word.

## Corners
Flat. No rounded corners except where the cockpit canopy demands a curved path.

## Depth
Flat. No drop shadows. Glow allowed on engines, lasers, and the screen-flash. Heat haze allowed on the sunset horizon.

## What NOT to Do
- Do NOT render the Lucasfilm/Disney logo as a raster.
- Do NOT use John Williams' score (the public-domain cue at `audio.mp3` is the only audio).
- Do NOT introduce Three.js — every scene must use HyperFrames-native primitives (CSS, SVG, GSAP, raw WebGL fragment shaders on a `<canvas>`).
- Do NOT call `Math.random`, `Date.now`, or use `requestAnimationFrame`-driven state.
