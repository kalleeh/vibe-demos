# Contraption Lab Asset Pipeline

## Overview

Assets for Contraption Lab parts flow through a deterministic three-stage pipeline:

1. **Generate** (`generate_image_sd35`) – create a transparent cutout using Stability AI's Stable Diffusion 3.5 Large (via Bedrock MCP)
2. **Cut** (`remove_background` MCP) – automatically clean-cut the background
3. **Process** (`make-sprite.mjs`) – trim to alpha bounding box, downscale to ≤256px, write web-ready PNG

## make-sprite.mjs

**Usage:**
```bash
node contraption-lab/assets/make-sprite.mjs <input.png> <partType> [maxpx=256]
```

**Input:** A PNG with transparency (typically from `remove_background`).

**Output:** Writes `assets/parts/<partType>.png` with:
- Tight alpha bounding box (no transparent margins)
- Maximum dimension ≤ `maxpx` pixels (default 256)
- High-quality downscaling if needed
- Base64 data URL → PNG binary

**Implementation notes:**
- Uses Playwright Chromium headless canvas (at `/tmp/pw/node_modules/playwright`)
- No repo dependencies, no package.json
- Deterministic: same input → same output every time
- Prints final dimensions and file size: `wrote .../parts/<partType>.png WxH bytes`

## Prompt template

Generate sprites with this approach:

```
A funky 1990s Incredible Machine cartoon prop. 
Single centered object on a plain pale neutral background.
The background must be clearly separated (for automatic removal).
NO magenta backgrounds. NO text or shadows.
[For plank parts: strict flat side-profile horizontal bar, no perspective or legs.]
```

**Characteristics:**
- Cartoon style (not realistic, not minimalist)
- 1990s visual grammar (chunky, playful, bright)
- Single object, clearly isolated
- Pale neutral bg: cream, light gray, or pale blue
- Clean alpha removal (no halos or anti-alias artifacts)

## Pilot findings (2026-06-20)

PILOT (2026-06-20): SD3.5 ignores #FF00FF magenta backgrounds — do NOT use magenta.
Use remove_background (MCP) to cut out, then make-sprite.mjs to trim+downscale.
Plank parts must be strict flat side-profile (the pilot ramp came back in 3/4 perspective with legs).

## Seed & prompt log

| Part | Seed | Prompt | Status |
|------|------|--------|--------|
| ball | 73101 | A large translucent bounce ball with a glossy shine, 1990s Incredible Machine cartoon style, centered on a pale cream background, single object. | ✓ Verified |

*Add rows as new parts are generated. Document seed (for reproducibility), exact prompt, and any issues.*
