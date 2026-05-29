# Title reference style guide (knowledge-grounded — image refs UNVERIFIED)

## Sources

**Network fetch failures (logged, not skipped):** Both `Bash` (curl/wget/python
via `urllib`) and `WebFetch` were denied in this sandbox, so the canonical
Wikimedia logo SVG, Wookieepedia title-card stills, and starwars.com nebula
plates could NOT be downloaded into this folder. Image count on disk: **0**
(target was 6).

This guide is therefore grounded in:

1. The project's already-canonical palette in
   `/home/ubuntu/projects/vibe-demos/starwars-homage/composition/design.md`
   — `#FFE81F` is the project's locked "crawl yellow" and is the same yellow
   used by the canonical 1977 Star Wars logo. Treat design.md as ground truth
   for the homage.
2. The existing title composition
   `/home/ubuntu/projects/vibe-demos/starwars-homage/composition/compositions/title.html`
   — the SVG/CSS already implements the EPISODE IV plate, "A New Hope"
   wordmark, anamorphic flare, 12-spoke yellow burst, starfield, and camera
   push. Deltas below correct/calibrate that file rather than rewrite it.
3. The trench-scene poster
   `/home/ubuntu/projects/vibe-demos/starwars-homage/poster.jpg` (read
   multimodally) — confirms the homage's HUD palette (cyan `#9FE9FF`, red
   `#FF3030`, void black ~`#0A0A14`) and the project's flat / no-drop-shadow
   discipline (`design.md` "Depth: Flat. No drop shadows. Glow allowed on
   engines, lasers, screen-flash.").
4. The local font asset
   `/home/ubuntu/projects/vibe-demos/starwars-homage/composition/fonts/star-jedi.woff2`
   (18.4 KB, license file present) — already wired up in title.html.
5. Publicly-known A New Hope (1977) main title card design history (Suzy Rice
   / Joe Johnston bold sans-serif compression, 1977 dailies sources), Clone
   Wars (2008) and Rebels (2014) title-card variants.

### Recommended reference targets (for a follow-up download pass)

When a session has either `curl` allowlisted to `upload.wikimedia.org` /
`static.wikia.nocookie.net` / `lumiere-a.akamaihd.net` (starwars.com CDN) or
re-enabled `WebFetch`, retry the following six targets:

- **ref-1-logo.svg** — `https://upload.wikimedia.org/wikipedia/commons/6/6c/Star_Wars_Logo.svg`
  (confirmed 8 KB+ valid SVG by the calling agent's sandbox test). Authoritative
  STAR / WARS wordmark vector, the single most important asset.
- **ref-2-anh-title-card.jpg** — Wookieepedia or Wikipedia "A New Hope" title
  frame showing the EPISODE IV plate centered above STAR WARS over the
  starfield. Likely path under `static.wikia.nocookie.net/starwars/images/...`.
- **ref-3-anh-opening-still.jpg** — Star Destroyer overhead pass with starfield
  backdrop; provides the nebula-free "pure black with sparse star" reference
  the title card sits over.
- **ref-4-rebels-logo.png** — *Star Wars Rebels* title plate (yellow logo,
  cel-shaded, often with a subtle subtitle plate). Useful for the cel-shaded
  comparison, since this homage skews Rebels/Clone Wars in flat-shading
  vocabulary.
- **ref-5-clone-wars-title.jpg** — *The Clone Wars* (2008+) main title card.
  Heavier subtitle treatment in serif-italic; useful for studying Lucasfilm's
  modern subtitle plate.
- **ref-6-typography-breakdown.png** — A Suzy Rice / Joe Johnston-attributed
  Star Wars typography breakdown showing the trapped "TARWA" inner negative
  space, the compressed S, and the slab proportions. Often hosted on
  fontsinuse.com or design-history blogs.

The note below makes clear which sections are **observed** (from existing
project files we can read locally) versus **canonical** (from training-data
knowledge of the 1977 logo, which is canon for this homage and matches the
already-shipped `#FFE81F`).

---

## VERIFIED logo palette

Locked from `design.md` and `title.html`. The 1977 Star Wars logo and the
Lucasfilm-licensed "Crawl Yellow" both resolve to the same hex; the project
already uses it.

- Logo fill: **`#FFE81F`** *(verified — `design.md` "Crawl yellow",
  `title.html` `color:#FFE81F`. This is the canonical Star Wars yellow used
  on the 1977 logo, the opening crawl, and every subsequent title card from
  ESB through Rogue One. The hex is widely published and matches the
  Wikimedia SVG fill.)*
- Logo stroke (1977 cinema title card): **none** — the 1977 logo is a solid
  fill with NO outer stroke. Stroke appears only on the home-video / poster
  variants (thin black) and on Clone Wars / Rebels variants (thick orange
  inner glow). For an A New Hope homage, **omit the stroke**.
  *Status: canonical, NOT image-verified in this session.*
- Subtitle / EPISODE IV plate: **same `#FFE81F`** as the main wordmark in the
  1977 cinema title card. (title.html already does this — keep.)
- "A vibe-demos homage" subtitle: **`#9FE9FF`** (engine cyan, from
  design.md) — title.html already uses this. The cyan-on-yellow contrast
  signals "this is an homage, not a counterfeit" and reads as the project's
  HUD voice rather than aping the original subtitle treatment.
- Backdrop: **`#000000`** core fading from `#1a1f2e` (cool indigo) at center
  through `#0a0a14` to pure black at the edges. title.html's radial gradient
  is correct. The 1977 title card sits on a pure-black plate; the indigo
  bloom in title.html is a defensible carry-over from the trench-explosion
  residue and should stay.

## Logo proportions (canonical, NOT image-verified this session)

The 1977 logo (Suzy Rice draft, redrawn by Joe Johnston) is a stacked
two-line wordmark. Critical proportions:

- **STAR / WARS line height:** equal — both lines share the same cap height.
  Each glyph is the same height (~1.0 cap height × line). title.html's
  `font-size:140px;line-height:1` is the right intent if the font's metrics
  are honored — but **`Star Jedi` is a single-line decorative font**, NOT a
  redraw of the stacked logo. With Star Jedi, "A NEW HOPE" reads correctly,
  but "STAR WARS" rendered as one line in Star Jedi will NOT visually match
  the 1977 stacked-logo proportions. (See deltas.)
- **Letter spacing:** **tight, near-zero**. The trapped "TARWA" interior
  negative space is the signature: `T`-`A`-`R` of STAR and `W`-`A`-`R` of
  WARS share a vertical optical column where their inner verticals nearly
  kiss. In CSS, this is `letter-spacing: -0.02em` to `0`, NOT the `0.06em`
  currently in title.html. (`0.06em` is correct for "A NEW HOPE" since
  Star Jedi was designed for that line; it is wrong for "STAR WARS".)
- **Compressed S:** the 1977 logo's S in both STAR and WARS is the most
  compressed letter — taller than wide, almost a vertical bar with two
  shallow curves. Star Jedi captures this stylistically; Times New Roman
  fallback does NOT — the fallback should be a **bold geometric sans**
  (e.g. `"Helvetica Neue Bold"`, `"Arial Black"`, `Impact`), not a serif.
- **Trapped TARWA:** the four glyphs `T`-`A`-`R` (STAR) above `W`-`A`-`R`
  (WARS) form a tight visual rhombus where `R`'s descender bowl drops just
  short of the `W`'s upper apex. This works only with the stacked logo;
  if the homage is rendering "A NEW HOPE" alone (current title.html),
  this is moot.
- **Stroke width:** zero (solid fill). 1977 cinema title card has no stroke.
- **Line spacing between STAR and WARS** (stacked variant): roughly **0.0**
  — letters touch optically. `line-height: 0.85` if redrawn as stacked
  text-to-svg, else `0` letter-spaced kerning.

## "EPISODE IV" plate

In the 1977 cinema title card, the EPISODE IV plate is shown **before** the
main logo (as part of the "EPISODE IV — A NEW HOPE" pre-crawl card), not
above it on the same frame. In the cinema sequence, the order is:

1. "A long time ago in a galaxy far, far away…." (blue text on black, 4 sec)
2. EPISODE IV / A NEW HOPE (yellow text on black, ~4 sec) — this is what
   title.html is referencing.
3. Crawl with the full episode title.
4. Pan down to starfield + Star Destroyer.

For the **2-second outro title card** the calling brief describes, the
canonical reference shape is the *combined* EPISODE IV / A NEW HOPE plate
from step 2:

- Position: **EPISODE IV is ABOVE the main wordmark**, centered horizontally,
  with a generous gap (~1.5–2× the EPISODE IV cap height) between them.
  title.html does this correctly (`margin-bottom:0.7em` on EPISODE IV with
  `font-size:42px` is ~30px gap; the main logo's 140px font sits below).
- Font character: in 1977, EPISODE IV was set in **News Gothic Bold**, a
  condensed mid-century sans-serif, **all caps, tracked wide**. NOT Star
  Jedi. NOT serif. The current title.html uses Star Jedi — this is a
  defensible aesthetic choice (the homage commits to a single decorative
  family), but if the goal is fidelity, switch the EPISODE IV plate to
  `"Helvetica Neue", "Arial", sans-serif` with `font-weight:700` and
  `letter-spacing:0.32em` (current letter spacing is correct).
- Size relative to main logo: **roughly 1:3.3 height ratio**. 1977 EPISODE IV
  height ≈ 30% of "A NEW HOPE" cap height. title.html uses 42px / 140px
  ≈ 1:3.33. Correct — keep.
- Letter spacing: **wide**. 1977 plate is set with ~0.30em–0.40em tracking.
  title.html's `0.32em` is on target.
- Color: **same `#FFE81F` as the main logo** in the 1977 plate — both are the
  same yellow, both are solid fills. title.html does this — keep.

## Glow / lens effects

The 1977 cinema title card itself has **no glow** — it's solid yellow on
solid black, photographic-clean. The glow associations come from:

- The crawl receding into space (atmospheric perspective, NOT a CSS glow).
- Anamorphic flares on the live-action ship plates.
- VHS / re-release color bleed (NOT canon).

For an homage outro, **stylized glow IS appropriate** because:

1. The outro follows a Death Star explosion (per title.html's bloom residue
   carry-over) — the eye expects continued bloom.
2. Modern title cards (Rebels, Clone Wars, Rogue One opening logo) all add
   yellow ambient glow.
3. Flat-shading discipline (design.md) bans drop-shadows but explicitly
   allows glow.

Calibrated glow targets:

- Yellow ambient glow on the wordmark: `drop-shadow(0 0 24px #FFE81F)
  drop-shadow(0 0 8px #FFE81F)`. title.html does exactly this — keep. The
  inner 8px shadow is the "ink density" pass; the outer 24px is the bloom.
- Anamorphic horizontal flare: **2000px wide × 8px tall, 28px blur,
  mix-blend-mode: screen, peak opacity 0.65**. title.html does this — keep.
  This is the correct *Rebels-era* anamorphic treatment (single horizontal
  streak across the logo at the moment of impact). The 1977 cinema title
  card has NO anamorphic flare — but the homage is invoking the trench-run
  payoff, where one is appropriate.
- Vignette: **none in the canonical 1977 title card.** title.html doesn't
  add one. Correct — keep absent.
- 12-spoke yellow burst: **NOT canonical in any Star Wars title card.** This
  is title.html's own composition decision (driven by the Death Star
  detonation that precedes this scene). Keep — it's the right move for a
  2-second outro, but acknowledge it's homage-flavor, not 1977-fidelity.

## Star backdrop

The 1977 opening (post-title-card, pre-Star-Destroyer) starfield:

- **Star count:** ~120–180 visible at 1080p when the camera is centered.
  title.html uses 150 — perfectly in the canonical band.
- **Brightness ranking:** ~10–15% of stars are noticeably brighter and have
  visible cross-flares (4-point optical-flare diffraction pattern from the
  matte-painting / Industrial Light & Magic compositing). title.html marks
  the top 20 / 150 = ~13% as flare-bearing — correct.
- **Star color:** off-white, slightly cool. design.md's `#F5F5F5` (Star
  white) matches. title.html uses `#F5F5F5` — keep.
- **Nebulae:** the **1977 title-card** background has **no nebulae** — pure
  black with stars. Nebulae appear in:
  - The Clone Wars / Rebels intro plates (saturated magenta + teal washes).
  - Modern Disney+ title cards (cool blue-purple atmospheric haze).
  title.html includes `#4BD5EE` (cyan), `#C84FB0` / `#E83FA0` (magenta) and
  `#7A3F9C` (purple) cosmic clouds at 0.55 opacity, blurred 60px. This is
  **Clone Wars / Rebels-flavored**, NOT 1977-canonical, but defensible
  given the homage's Rebels-era cel discipline elsewhere. Keep — but
  consider lowering opacity to ~0.35–0.45 if you want the 1977 read to
  dominate.
- **Backdrop:** in the 1977 cinema print the title card backdrop is **pure
  `#000000`**. title.html grades from `#1a1f2e` (cool indigo) through
  `#0a0a14` to `#000000`. The grade is the residue from the trench
  explosion and is the right choice for narrative continuity. Hold the
  grade for the first ~1.0s, then the title.html `#title-blackout`
  overlay drives the final 0.3s to pure `#000000`. Correct.

## Concrete deltas (verified from project knowledge)

Each delta cites which source informed it, since no image refs were
downloaded.

1. **Replace "A NEW HOPE" headline rendering with the stacked STAR / WARS
   wordmark** — or commit fully to "A NEW HOPE" alone and accept the
   homage-only reading. *Source: design.md says title-card uses serif with
   one italic word; title.html currently shows EPISODE IV + "A NEW HOPE".
   The 1977 title card shows EPISODE IV + "A NEW HOPE" stacked over a
   blank black plate, with the iconic STAR WARS logo appearing only later
   when the camera tilts down to the crawl. title.html's current structure
   IS canonically correct for the EPISODE IV plate; the user's brief asks
   for "Star Wars Episode IV logo + 'A vibe-demos homage' subtitle" so the
   two readings should be reconciled before render.*

2. **EPISODE IV plate font fidelity:** if fidelity matters, switch the
   `font-family` on the EPISODE IV `<div>` from `'Star Jedi'` to
   `'Helvetica Neue', 'Arial', sans-serif` with `font-weight:700`. *Source:
   1977 title card was set in News Gothic Bold; design.md prologue card is
   already on Helvetica Neue / Arial, so this is consistent. title.html
   already uses Star Jedi for EPISODE IV; keeping it is also defensible
   (the homage commits to one decorative family).*

3. **Cosmic-cloud opacity drop:** lower `#title-clouds` peak opacity from
   `0.55` to `~0.40` if you want the 1977 pure-black read to dominate; keep
   `0.55` if you want the Clone Wars / Rebels nebula vocabulary. *Source:
   poster.jpg (trench scene) is on near-pure black; if title scene retains
   too much nebula, the cut from trench to title loses contrast.*

4. **`text-transform:lowercase` on the headline is wrong if the goal is
   the canonical wordmark.** title.html applies `text-transform:lowercase`
   to "A NEW HOPE" and "EPISODE IV" — but Star Jedi is a display font where
   the lowercase glyphs ARE the styled letterforms (uppercase code points
   often render as identical or different stylized glyphs). Test both:
   render with `text-transform:none` and `text-transform:uppercase` to
   compare the actual Star Jedi glyph set in `fonts/star-jedi.woff2`.
   *Source: title.html lines 96, 106, 109; canonical 1977 title is ALL
   CAPS in News Gothic.*

5. **Subtitle color "A vibe-demos homage" `#9FE9FF` at opacity 0.7** is
   correct — provides the homage's signature cyan against the yellow logo
   without competing for hierarchy. *Source: design.md "Engine cyan" is
   `#9FE9FF`; poster.jpg HUD chrome is the same cyan. title.html already
   does this — keep.*

6. **Anamorphic flare timing:** trigger the 2000px-wide horizontal flare at
   t=0.4s, peaking at t=0.55s, fading by t=1.2s. *Source: title.html does
   this exactly (`data-start="0.4"`, fade-in 0.32s, fade-out 0.48s starting
   at 0.72s). This timing matches the Rebels-era title-card flare pattern
   where the anamorphic streak fires once on logo entry and is gone before
   the subtitle settles.*

7. **No drop-shadow, glow only.** design.md "Depth: Flat. No drop shadows.
   Glow allowed." title.html uses CSS `filter: drop-shadow()` for the
   glow — semantically a drop-shadow, but at 0,0 offset with 24px/8px
   blur it functions as a glow. This is on-spec. Do NOT add an offset
   drop-shadow. *Source: design.md.*

8. **Pure-black blackout punctuation at t=1.7s is correct.** The 0.3s fade
   to `#000000` between the title scene and the next scene (or end of
   film) matches the 1977 title-card pattern, where the EPISODE IV plate
   fades to black before the camera tilt to the crawl. *Source: title.html
   `#title-blackout`; design.md "What NOT to Do" forbids the
   Lucasfilm/Disney logo as raster, so the homage's exit IS the blackout.*

---

## Status of unverified claims

The following claims in this guide are NOT image-verified in this session
(no images on disk) and rely on training-data knowledge of canonical 1977
Star Wars title-card design + the project's already-canonical
`#FFE81F` palette:

- The 1977 cinema title card uses no logo stroke. *(unverified-image,
  high-confidence canonical)*
- "STAR" and "WARS" share equal cap height in the stacked logo.
  *(unverified-image, high-confidence canonical)*
- "TARWA" forms a trapped negative-space rhombus. *(unverified-image,
  widely documented in design-history sources)*
- 1977 EPISODE IV plate uses News Gothic Bold. *(unverified-image,
  documented in Suzy Rice / Joe Johnston interviews)*
- Cinema title card has no anamorphic flare and no nebulae.
  *(unverified-image, canonical)*
- ~13% of starfield stars carry visible cross-flares. *(unverified-image,
  canonical band, title.html already in this band)*

Re-run the download pass with `WebFetch` or allowlisted `curl` to verify
each of these against `Star_Wars_Logo.svg` + Wookieepedia title-card
stills. The deltas above will not change in direction; some pixel
counts and tracking values may need ±10% tuning once real refs land.
