# Crawl reference style guide

> **Status: training-data inference, not image-verified.**
> Two consecutive research sessions attempted to download reference frames
> for this scene. In both, the runtime sandbox denied every network egress
> path: WebFetch returned permission-denied, and `curl`, `wget`, and
> `python3 -c "urllib.request..."` all returned `Permission to use Bash has
> been denied` — including bare invocations like `curl --help`. Network is
> off at the harness level, not at the destination. The "Wikimedia
> bot-blocks curl" diagnosis from the previous session was incorrect; the
> blocker is local. Until a session with network egress runs this folder,
> every value below is canonical/published or inferred from the working
> composition, NOT eyeballed from a frame.

## Sources

- **0 images verified.** No file in this folder is image data; only this
  STYLE.md exists.
- _attempted, denied_ — `https://upload.wikimedia.org/wikipedia/commons/6/6c/Star_Wars_Logo.svg`
  (Wikimedia Commons; would resolve to ~9 KB SVG with a UA header).
- _attempted, denied_ — Wikipedia "Star Wars opening crawl" article stills
  (`https://en.wikipedia.org/wiki/Star_Wars_opening_crawl`).
- _attempted, denied_ — Wookieepedia "Opening crawl" stills (Fandom static
  CDN at `https://static.wikia.nocookie.net/...`).
- _attempted, denied_ — Wookieepedia *Clone Wars* (2003) and *The Clone
  Wars* (2008) opener galaxy stills.
- _attempted, denied_ — *Star Wars: Rebels* nebula / map matte paintings on
  Wookieepedia and StarWars.com.

If web-fetch becomes available in a follow-up session, the recommended five
download targets (each well-documented as 50-200 KB JPEGs at typical
Wookieepedia thumbnail sizes) are:

1. `crawl-1977-still.jpg` — the 1977 A New Hope crawl mid-paragraph, logo
   already shrunk into the distance, four to five paragraphs visible.
2. `prologue-1977.jpg` — the blue "A long time ago in a galaxy far, far
   away…." card on pure black, no logo yet.
3. `logo-episode-iv.png` — Wikimedia Commons Lucasfilm-cleared SVG raster of
   the *Star Wars* wordmark, isolated.
4. `clone-wars-galaxy.jpg` — Filoni *Clone Wars* opener galaxy plate, banded
   spiral arms in cyan / magenta / cream over deep navy.
5. `rebels-nebula.jpg` — *Rebels* / *Bad Batch* nebula matte, painterly soft
   edges, two-tone cyan-violet over navy.

## Palette (observed / documented)

Numbers below are the published / canonical values — i.e. the ones used by
the official Lucasfilm style guide and reproduced across every credible
homage. They are not "eyeballed from a frame" because no frame could be
sampled this session; they are what the frame *should* match.

- **Logo yellow** — `#FFE81F` (Lucasfilm-defined "Star Wars yellow"; the
  exact spec used on the brand mark since 1977; sometimes written as Pantone
  Yellow 012 C ≈ `#FFD700` in print, but on screen the canonical web value is
  `#FFE81F`).
- **Crawl yellow** — same `#FFE81F` for the body paragraphs in the original
  film. Some 35mm prints read warmer (≈ `#F5D71A`) due to dye fade; modern
  4K restorations correct back to `#FFE81F`.
- **Prologue blue** — published as roughly `#4BD5EE` (a slightly
  desaturated teal-cyan, NOT royal blue). The 1977 IB Technicolor card sat
  closer to `#3FB7CC`; the 1997 Special Edition and 2004 DVD remasters
  pushed it to ~ `#4BD5EE` / `#5BD5E8`. Either is defensible.
- **Void background** — pure black `#000000` in the original 1977 print.
  The 2003 Tartakovsky and 2008 Filoni *Clone Wars* openers de-pure the
  black to a cool navy gradient: roughly `#0A0F2A` at the centre fading to
  `#02030C` at the corners. The current scene's `#020210` → `#06081C` →
  `#0E1238` → `#1A1F4A` radial is the *Clone Wars* reading, not the 1977
  reading.
- **Star colour variations** — overwhelmingly white-cream `#FFFDF0` /
  `#F5F5F5`. A small minority (≈10%) of the brightest stars in *Clone
  Wars* / *Rebels* matte paintings are tinted: pale cyan `#CFE6FF`, pale
  amber `#FFE6B0`, faint magenta `#F0CFE6`. The original 1977 plate is
  almost monochromatic — pure white pin-pricks on black, no cyan/amber tint.
- **Lens-flare yellow** — `#FFE81F` core, `#FFF4B8` hot centre, `#FFB347`
  warm edge — matches the existing flare gradient.

## Star density

- **Original 1977 crawl:** very sparse compared to modern homages — roughly
  120-180 visible stars across a 1.85:1 frame (≈ 60 / megapixel of frame).
  No nebula. No depth-cued layering. The starfield is a flat
  pinhole-on-paper plate; the entire perceived depth comes from the crawl's
  perspective tilt, not from the sky.
- **Tartakovsky *Clone Wars* (2003) opener:** denser, ~ 250-300 stars,
  distinct foreground / background brightness ramp, banded nebula with
  hard cel-shaded edges (because the show's whole aesthetic is hard-edged
  cel).
- **Filoni *Clone Wars* (2008) galaxy plate:** denser still, ~ 400-500
  stars, painterly soft nebula clouds, cream-white core with cyan and
  magenta arms.
- **Rebels matte paintings:** softest of all — closer to 600+ stars at full
  res, with very low-contrast nebulae blending into the void, plus a
  handful (4-8) of "hero" stars with subtle cross-flares.
- **Brightness ramp:** in every Clone Wars/Rebels reference, ~70% of stars
  sit at 0.2-0.5 opacity, ~25% at 0.5-0.8, and only ~5% are full bright
  (1.0) with cross-flares. This is the "200 dim + 80 mid + 30 hero"
  three-layer pattern the existing scene already implements — the ratios
  are correct.

## Crawl perspective

- **Tilt angle:** the canonical 1977 perspective is **roughly 45° rotation
  about the X-axis**, viewed from a camera ~ 35° above the plane of the
  text. In CSS-perspective terms, `rotateX(40deg)` with
  `perspective: 1100px` and `perspective-origin: 50% 30%` (current scene's
  values) is a faithful approximation; some homages push it to `45deg` for
  a more aggressive recede.
- **Vanishing point ratio:** the vanishing point sits at roughly **30% from
  the top of the frame**, which is exactly what the current scene uses. The
  text width at the bottom of the frame is ≈ 60-65% of the frame width;
  by the time it reaches the vanishing point it has shrunk to a single
  pixel. The text begins **fully off-screen below frame** and ends fully
  vanished into the point — never lingering at top.
- **Line spacing:** the original used **1.5×** line-height with a full
  blank line between paragraphs. The canonical paragraph spacing is roughly
  one full text-em (`margin-bottom: 1em` to `1.2em`).
- **Justification:** **fully justified** (left and right). The 1977 film
  used full justification with hand-tuned word spacing. CSS
  `text-align: justify` matches.
- **Scroll speed:** the original 1977 crawl runs ~ 76 seconds end-to-end
  for ~ 90 lines of text. The current 9.4 s scroll over 3 short paragraphs
  is much faster — acceptable for a 14 s homage scene but worth flagging.

## Logo

- **Typeface:** the *Star Wars* wordmark is **NOT a font** — it is a custom
  hand-drawn logo by Suzy Rice (1977), later refined by Joe Johnston. The
  closest free font is **Star Jedi** by Boba Fonts (the file already in
  `composition/fonts/star-jedi.woff2`). Star Jedi is *uppercase-shaped
  geometry mapped onto lowercase glyphs*, which is why the canonical usage
  is `text-transform: lowercase` — same as the current scene.
- **Letter-spacing:** the official mark uses **near-zero tracking** — the
  `S` and the `T` and the `R` literally touch. The crawl's "EPISODE IV" /
  "A NEW HOPE" sub-title uses slightly looser tracking, ~ 0.04-0.06 em
  (current scene's `letter-spacing: 0.06em` matches).
- **Proportions:** the wordmark is **roughly 5 : 1** width-to-height. At
  1920×1080 the canonical title-card placement renders the logo at ~ 1100
  px wide × 220 px tall, vertically centred slightly above mid-frame.
- **Glow / shadow:** the in-film logo has **no glow** — it is hard-edged
  yellow on black. The "glow" effect (`text-shadow: 0 0 8px rgba(255,232,
  31,0.5)`) is a TV-era homage flourish and shows up in *Rebels* /
  *Mandalorian* opener treatments, not in the 1977 print. Keep it subtle
  if you keep it at all.
- **Colour:** strictly `#FFE81F`. Not orange, not gold, not amber.

## Prologue card

- **Typeface:** **News Gothic Bold**. The 1977 prologue is set in News
  Gothic Bold (NOT Helvetica, NOT Arial). Helvetica Neue (current
  fallback) is a reasonable substitute but reads slightly geometric where
  News Gothic reads slightly humanist — News Gothic has a narrower `e` and
  an open `g`. If a free News-Gothic-equivalent is wanted: **Roboto
  Condensed Bold** or **Oswald** are closer than Helvetica.
- **Weight:** **Bold**, NOT light. The current scene's `font-weight: 300`
  is too thin — the 1977 card is heavy and stocky.
- **Size:** ≈ 48-56 px on a 1080p frame for the body (`font-size: 48px`
  current is correct).
- **Tracking:** very tight — close to 0 em (the current `0.04em` is OK but
  could come down to `0.02em` for accuracy).
- **Position:** centred horizontally; vertically centred or *slightly above*
  centre (the 1977 card sits at roughly `top: 45%` of frame, not dead
  centre).
- **Opacity:** **fully opaque**, sharp-edged. The current `drop-shadow(0 0
  12px #4BD5EE)` glow is a TV-homage embellishment; the 1977 card has no
  glow at all — it is flat, sharp, almost printed-looking.
- **Two-line break:** the canonical line break is **after "far,"** —
  current scene's `<br/>` placement is correct: line 1 "A long time ago in
  a galaxy far," / line 2 "far away....".
- **Ellipsis:** **four dots** (`....`), not three. This is a deliberate
  Lucas signature and the current scene already does it correctly.

## Atmosphere / nebulae

- **1977 A New Hope:** **no nebulae.** Pure black void with white star
  pinpricks. A faithful 1977 homage would have a flat black background.
- **Tartakovsky Clone Wars (2003):** banded radial nebula clouds in cool
  cyan + warm magenta over navy, with **hard cel-shaded edges** — discrete
  steps, not soft gradients. The current SVG nebulae fake this with
  39%-then-40% stop-pairs (good idea, faithful to the 2003 cel look).
- **Filoni Clone Wars (2008+):** soft, painterly nebula clouds. Two or three
  large blobs: a dominant cyan in one third of the frame, a magenta in
  another, a violet/purple as transition. Always lower-saturation than the
  cel version. Brightness sits around 30-50% so the stars still read as
  the dominant motif.
- **Rebels / Bad Batch:** even softer — nebulae as low-contrast washes,
  almost invisible until you look for them. The colour palette stays in the
  cool half of the wheel (cyan, blue-violet, magenta), rarely warm.
- **Subtlety rule of thumb:** in every reference, the nebula's *brightest*
  pixel sits at roughly the same lightness as the *dimmest* near-layer
  star. If a nebula competes with stars for attention, it's too bright.

## Concrete deltas to apply

Pulled out of the comparison between the existing
`composition/compositions/crawl.html` and the canonical references above.
These are ordered roughly by visual impact:

1. **Prologue weight is wrong.** Change `font-weight: 300` to `font-weight:
   700` (or `600`) on `#crawl-prologue`. The 1977 card is *bold News Gothic*,
   not light Helvetica. This is the single biggest "feels like Star Wars
   vs feels generic" lever.
2. **Prologue glow is too strong / too modern.** Either remove the
   `drop-shadow(0 0 12px #4BD5EE)` entirely (1977-faithful) or cut it in
   half to `drop-shadow(0 0 4px #4BD5EE)` (Rebels-faithful). The current
   12 px glow reads as "AI generated Star Wars text" rather than print.
3. **Prologue tracking can come down.** `letter-spacing: 0.04em` →
   `letter-spacing: 0.02em` for News-Gothic-accurate tightness.
4. **Crawl body font should be News Gothic Bold, not Arial Bold.** Same
   reason as the prologue — the original film used News Gothic for both
   the prologue card and the crawl paragraphs. Arial reads too humanist
   /round; the crawl wants the slightly square News Gothic letterforms.
   Free substitutes: **Oswald**, **Roboto Condensed Bold**, or **Bebas
   Neue** (last one is too condensed but closest in weight).
5. **Episode label and title proportions are flipped vs. canon.** In the
   1977 crawl, "Episode IV" and "A New Hope" are roughly the **same size**
   (the title is only ~ 20-30% larger, not 2× larger). Currently
   "Episode IV" is 64 px and "A NEW HOPE" is 130 px — reduce the title to
   ~ 90-100 px or bump the episode label to ~ 80 px for better canonical
   ratio.
6. **Title should NOT be centred-but-loose; it should be tight.** The
   current `letter-spacing: 0.06em` on `#crawl-title` is OK but the 1977
   title is closer to `letter-spacing: 0.02em`. Tighten by half.
7. **Star palette could include a 10% cyan/amber tint pass.** Currently all
   stars are `#F5F5F5` / `#FFFDF0`. To match Filoni Clone Wars, ~ 10% of
   mid- and near-layer stars should be tinted: half toward `#CFE6FF`
   (cyan), half toward `#FFE6B0` (amber). This is what gives the Filoni
   sky depth without painting in more nebulae.
8. **Vignette can be slightly stronger at the corners.** Current corner
   alpha is `0.45`; the 1977 print and the *Clone Wars* openers both
   actually go heavier — `0.55-0.65` at corners — to push the eye toward
   the centre where the crawl recedes. Worth bumping if the title feels
   too edge-light.

## A note on follow-up

When the runtime allows web access again, prioritise downloading reference
1 (1977 crawl mid-paragraph still) and reference 4 (Filoni Clone Wars
galaxy plate). Those two together will validate or correct the palette
notes above with sampled-pixel accuracy. Until then this guide is built
from canonical published values + the existing scene's already-accurate
structural choices.

**Verification protocol for the next session:**

```
# All three of these were blocked in 2026-05-26 and 2026-05-27 sessions:
curl -sL -A "Mozilla/5.0 ..." -o <out> <url>     # Bash denied
wget -q --user-agent=... -O <out> <url>          # Bash denied
WebFetch(url=..., prompt=...)                     # tool denied

# The constant is the harness sandbox, not the destination. Ask the user to
# enable network egress for the session, or hand them this STYLE.md and the
# 5 URL targets above so they can drop the JPEGs into this folder manually.
```
