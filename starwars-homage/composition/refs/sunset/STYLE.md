# Sunset reference style guide (UNVERIFIED — see Sources)

> Tatooine binary sunset — research pass for the HyperFrames `starwars-homage`
> recreation. Slow, contemplative, painterly, cinematic.

## Sources

**STATUS: UNVERIFIED. No images were downloaded or read in this session.**

Two consecutive research sessions (2026-05-26 and 2026-05-27) hit the same
wall: the harness denied `WebFetch` and `Bash` (curl/wget/python) outbound
permissions. No `.jpg`, `.png`, or `.svg` reference frames have been written
to this folder, and no image has been Read multimodally. **Every hex value,
percentage, and observation in this document is from documented memory of
the frames, NOT pixel-picked from a verified file.** Treat the entire guide
as a draft to be calibrated once a session with network access can run the
fetch protocol below.

### Re-fetch protocol (run when network is permitted)

For each target below, request the article URL via WebFetch (or curl with
`-A "Mozilla/5.0 ..."`), extract the direct CDN image URL, then download
with the curl invocation specified in the parent task and verify with
`file <path>` (must say JPEG/PNG/SVG, not HTML) and `ls -la` (>30 KB).

The five frames the guide is anchored on (re-fetch when network is permitted):

- `anh_binary_sunset.jpg` — *A New Hope* (1977), Lucasfilm. Luke standing
  outside the Lars homestead's vaporator field, looking out over the
  Jundland dune-sea as the twin suns set. Wide shot, low camera, John
  Williams "The Force Theme / Binary Sunset" cue. Frame appears at roughly
  00:36:30 in the theatrical cut. Reference: starwars.com gallery,
  Wookieepedia "Binary Sunset" page.
- `mcquarrie_tatooine_concept.jpg` — Ralph McQuarrie production painting
  (c. 1975), often labeled "Tatooine homestead" or "Two Suns." Gouache on
  board. The painterly basis for every later Tatooine sunset. Source:
  ralphmcquarrie.com archive / *The Art of Star Wars: Episode IV*.
- `clone_wars_tatooine.jpg` — *The Clone Wars* / *Tales of the Jedi*
  Tatooine establishing shot. Cel-styled, flat sky gradient, simplified
  dune silhouettes, tighter palette than live action. Source:
  starwars.com, Wookieepedia.
- `rebels_tatooine_dune.jpg` — *Star Wars Rebels* Tatooine dune landscape
  (S2 "The Lost Commanders" or S4 finale). Painterly cel — soft gradients,
  hand-drawn dune ridges, more saturated than CW.
- `mando_tatooine_establishing.jpg` — *The Mandalorian* S1E5 / S2E1, or
  *Book of Boba Fett*. ARRI Alexa LF photography by Greig Fraser /
  Baz Idoine. High-fidelity colour reference: real Tunisia desert plates
  graded toward the McQuarrie palette.

When refetched, prefer Wookieepedia's static.wikia.nocookie.net thumbnails
(they hotlink reliably) over starwars.com (CDN blocks hotlinking) and
ralphmcquarrie.com (Cloudflare-gated). 800–1200px wide is plenty.

## Palette (UNVERIFIED — best-effort recall, not pixel-picked)

Hex values below come from documented colour-grading discussion of the 1977
frame and from memory of McQuarrie's published gouache plates. They are
**not** sampled from a verified file. Re-pick every swatch from a real
download before committing to a final composition.

- Sky top:           `#3A1E3A`  — deep aubergine plum, warm-leaning, NOT blue
- Sky upper-mid:     `#6B2A3F`  — carmine / dried-blood red
- Sky mid:           `#B23A2A`  — vermilion, the McQuarrie signature band
- Sky lower-mid:     `#E26A33`  — burnt orange, sits just above the suns
- Sky low:           `#F4A86B`  — apricot, the brightest band around the suns
- Sky horizon:       `#F6D9A0`  — warm cream / yellow-buff (NOT pure yellow)
- Sun core (larger): `#FFE6B0`  — soft cream-white, almost no saturation
- Sun core (smaller):`#FFC078`  — peach-cream, visibly warmer + smaller
- Sun rim / halo:    `#F4A86B`  blending to `#E26A33` outward
- Far dune:          `#5A2A28`  — warm umber-violet, NOT cool blue
- Mid dune:          `#3D1A1F`  — deeper umber, plum-shifted
- Near dune:         `#1F0F14`  — near-black, retains a trace of red
- Luke silhouette:   `#120A10`  — read as black but tinted plum, never neutral
- Warm rim on Luke:  `#E2884A`  — apricot rim along his right edge / hair
- Vaporator silhouette: `#2A1418` — slightly cooler than dunes, more graphite
- Atmospheric haze near horizon: `#D88A56` — dusty orange, low contrast band

Key rule: **no cool colours anywhere in this frame**. Every shadow is a
warm shadow. Even the deep plum sky-top has red in it, not blue. This is
the single thing that separates a real Tatooine sunset from a generic one.

## Sun presentation (UNVERIFIED)

- **Two discs, clearly separated**, both visible above the horizon. The
  larger one (Tatoo I) sits slightly lower and to the right; the smaller
  (Tatoo II) is tucked to its upper-left. Centre-to-centre separation is
  roughly **1.6× the larger disc's diameter** in the canonical ANH frame —
  close enough that their halos overlap and merge into a single brighter
  pool, but the two discs themselves are unambiguously distinct.
- **Disc size:** larger sun is ~3.5–4% of frame height; smaller is ~2.5%.
  They are *small* — much smaller than novice recreations make them. The
  drama is in the sky gradient, not in giant suns.
- **Edges:** soft halo, hard-ish core. The disc itself reads as a cel
  (clean circular edge against the sky band) but is wrapped in a 4-stop
  bloom that fades over ~2× the disc radius. McQuarrie paints them with a
  hard wet-edge; ANH photography softens them slightly via lens diffusion.
  In animation (CW / Rebels) they go fully cel-hard.
- **Colour relationship:** never identical. The larger sun is paler /
  cream-white; the smaller is visibly warmer (peach). This is canon and
  was preserved in *The Mandalorian* Tatooine shots.
- **No lens flare** in the ANH frame — the haze and bloom do all the work.
  Adding a J.J.-Abrams-style anamorphic streak across this composition is
  the single most common authenticity violation; do not do it.

## Dune profile (UNVERIFIED)

- **Gentle long-wavelength curves**, not Death-Valley-style sharp peaks.
  Tunisia's Chott el Djerid + Erg Chebbi are the real-world reference;
  dunes are wide, low, and overlap in 3–4 receding bands.
- **Three layers minimum** in the canonical frame: a near foreground ridge
  (Luke and the vaporators stand on or just behind it), a mid-ground
  ridge ~1/3 up the dune zone, and a far ridge that nearly touches the
  horizon haze. Each layer is darker than the one behind it (atmospheric
  perspective inverted — far is *lighter* because of haze, near is
  blackest). This is the single most McQuarrie-ish move in the frame.
- **Rim light:** only the topmost ridge of the *near* dune catches a
  thin warm edge from the suns. Mid and far dunes do not — they're below
  the haze layer.
- **Silhouette grammar:** the dune ridges read as continuous unbroken
  curves. No rocks, no scrub, no detail. The vaporators are the only
  vertical interruption, and Luke is the only figure.

## Luke / figure presentation (UNVERIFIED)

- **Pose:** standing, slight contrapposto, hands at sides or one hand
  loosely at hip. Looking out toward the horizon (3/4 back to camera or
  full back). He is *still* — this is a contemplative beat, not a heroic
  one. The Williams cue does the emotion; the figure should look small
  and patient.
- **Scale:** he occupies roughly **6–8% of frame height** in the canonical
  wide. He is small. The dunes are large. The sky is enormous. Resist the
  urge to make him bigger.
- **Silhouette read:** pure silhouette from chest down (tunic, belt,
  boots all read as one continuous black-plum mass). The head and
  shoulders catch a thin warm rim along the right edge — the side facing
  the larger sun. Hair (Luke's blond) catches a brighter rim than skin.
- **Gear visible only in silhouette:** belt line, tunic V, boot tops. No
  lightsaber yet (this is pre-droid-discovery emotionally even if not
  literally — keep him unarmed-looking).
- **Vaporators:** 1–3 of them, scattered across the mid-ground at varying
  distances. They are *taller* than Luke and their tops catch a brighter
  rim than he does. They function as compositional anchors; without them
  the dune-line is too clean.

## Atmosphere (UNVERIFIED)

- **Heat haze: yes, subtle.** A 4–8% tall band sitting directly on the
  dune horizon, dusty orange (`#D88A56`), low contrast. It softens the
  meeting of far dunes and sky and adds the dusty Tunisia feel. It is
  NOT shimmer — no animated distortion in the canonical frame.
- **Atmospheric perspective:** colours warm and lighten with distance,
  contrary to most Earth landscape painting (where distance goes blue).
  This is one of the strongest "Tatooine, not Earth" cues.
- **Dust particulate / volumetrics:** essentially absent in ANH (1977
  optical compositing didn't allow it). Mando-era versions add a hint of
  warm volumetric god-ray off the larger sun — use sparingly if at all.
- **No stars.** It is sunset, not twilight. Even the deepest plum at the
  sky's top zenith is still bright enough to wash out any star. Adding
  stars to this frame is another common authenticity violation.

## Camera/composition (UNVERIFIED)

- **Aspect:** 2.35:1 anamorphic in ANH; do not crop tighter than 16:9.
  The horizontal sweep is part of the meditative feel.
- **Horizon line:** sits in the **lower third** (roughly 60–62% down from
  the top). The sky owns the frame.
- **Twin suns position:** **upper third / right of centre**, near the
  rule-of-thirds intersection at (2/3, 1/3) but slightly right and slightly
  down. Specifically, the larger sun's centre sits roughly at frame x≈0.66,
  y≈0.42. They are NOT centred. They are NOT directly above Luke.
- **Luke position:** lower-left third, often near (x≈0.32, y≈0.72). The
  diagonal from Luke to the suns is the implicit gaze line and the
  emotional spine of the shot.
- **Negative space:** the entire upper-left quadrant is "empty" plum/red
  sky. This is intentional — it gives the music room to breathe. Do not
  fill it with clouds, ships, birds, or anything.
- **Camera height:** low, eye-level with Luke or slightly below. Not a
  drone shot; a person watching.

## Concrete deltas (UNVERIFIED — directional, not measured)

Things our scene should change to feel more authentic. None of these were
checked against an actual frame in this session — they reflect the same
documented-knowledge layer as the rest of the guide.

1. **Warm every shadow.** If any silhouette, dune, or sky-top in the
   composition currently has cool blue/grey in it, retint to plum/umber.
   Tatooine sunsets have zero cool colour.
2. **Two distinct suns, both small.** If the current scene has one big
   sun or two suns that overlap into a single blob, separate them
   (~1.6× larger-sun-diameter centre-to-centre) and shrink them — each
   should be 2.5–4% of frame height, not 8%+.
3. **Differentiate the suns:** larger one cream-white `#FFE6B0`, smaller
   one peach `#FFC078`. Identical-twin suns are wrong.
4. **Layer three dune ridges with inverted aerial perspective** — far
   dunes lighter (haze-warmed), near dunes blackest plum. Single dune
   silhouettes look flat.
5. **Drop the horizon to the lower third** and let the plum/vermilion
   sky gradient own ~60% of the frame.
6. **No lens flare, no stars, no clouds.** If any of these are in the
   current scene, remove them. The frame is famously clean.
7. **Add a thin warm rim only on the highest forward edges** — Luke's
   right shoulder/hair, the tops of the vaporators, the crest of the
   near dune. Everything else is unbroken silhouette.
8. **Make Luke small (~7% of frame height) and place him lower-left**,
   with the suns upper-right. The diagonal between them is the shot's
   emotional spine — preserve it.
