# Launch reference style guide

## Sources

> **Reference acquisition status: BLOCKED — 0 images downloaded.**
>
> Outbound network is fully sandboxed in this run. Specifically:
> - `WebFetch` → permission denied on every host attempted (Wookieepedia, Wikipedia, starwars.com).
> - `curl` and `wget` invocations from Bash → permission denied at the harness level, even with the prescribed UA, Accept header, and `dangerouslyDisableSandbox` flag. The previous agent's diagnosis ("Wikimedia bot-blocks curl without UA") was incorrect; the curl call never reached Wikimedia at all — the sandbox blocks the process before the request leaves the host.
> - Same for `python3 urllib`, `python3 -m http.client`, etc.
>
> So this guide is a hybrid: it's grounded in (a) artefacts I CAN read, multimodally, that are already on disk; (b) the project's own canonical files; and (c) production-history facts about the 1977 ANH launch / Yavin briefing-and-launch beats and the Star Wars Rebels / Clone Wars cel-shaded re-skin that are unambiguous enough to act on without a fresh image pass.
>
> **Verified-image count: 0.** Every observed value below is marked **[memory]** when it comes from production-history knowledge, and **[on-disk]** when I can point to a file I read. Treat both as recommendations, not measurements. Re-run this brief with network access (allowlist `static.wikia.nocookie.net`, `upload.wikimedia.org`, `lumiere-a.akamaihd.net`) and replace the Sources table with downloaded stills before the next composition pass.

| File | What it is | Status | Read |
|---|---|---|---|
| `../../../poster.jpg` | Project's current homage poster — cyan trench HUD over near-black. Useful as a self-snapshot of the project's existing cyan/cel direction; not a canon launch reference. | On disk | Read OK |
| `../../snapshots/contact-sheet.jpg` | Snapshot of the *sunset* scene (binary sunset, twin suns, Luke silhouette). Not a launch reference, but confirms the project's palette discipline. | On disk | Read OK |
| `../../snapshots/frame-00-at-17.0s.png` | Same sunset scene, single frame at t=17s. Same palette confirmation. | On disk | Read OK |
| `../../compositions/launch.html` | The current launch composition itself. Existing SVG hex values are the GROUND TRUTH for "what the homage currently is", and this guide's `(current — keep)` annotations refer to lines in this file. | On disk | Read OK |
| `../../design.md` | Project palette canon: engine cyan `#9FE9FF`, laser red `#FF3030`, void black `#0A0A0A`, star white `#F5F5F5`, sunset apricot `#FFB347`. The launch scene already conforms. | On disk | Read OK |
| 1977 ANH "Red Squadron approach" stills (X-Wings 3/4 rear, S-foils open, Death Star in distance) | Suggested URLs for next pass: `static.wikia.nocookie.net/starwars/images/.../X-wing_NEGVV.png`, `upload.wikimedia.org/wikipedia/commons/.../X-wing_starfighter.jpg`. | **Not downloaded** | TODO |
| 1977 ANH Death Star "slow reveal" establishing shot (Falcon-POV emergence) | Suggested URLs: `static.wikia.nocookie.net/starwars/images/.../Death_Star.png`. | **Not downloaded** | TODO |
| Yavin Prime / Yavin IV McQuarrie production paintings (1975–76) | Source: `ralphmcquarrie.com` portfolio plates; also reproduced in *The Art of Star Wars* (Carol Titelman, 1979). | **Not downloaded** | TODO |
| Star Wars Rebels season 3–4 X-Wing cel-shaded ref (Phoenix Squadron) | Suggested URL: `static.wikia.nocookie.net/starwars/images/.../X-wing_Rebels.png`. | **Not downloaded** | TODO |
| X-Wing T-65B orthographic technical plate | Wookieepedia hosts the canonical 4-engine, 4-cannon, R2 dorsal arrangement with measurements. | **Not downloaded** | TODO |
| Death Star surface plating macro / model close-up | ILM 1976 model photographs; also *Star Wars: Complete Locations* (DK, 2005). | **Not downloaded** | TODO |

## X-Wing palette (recommended targets)

The current SVG values in `launch.html` are correct in spirit. Annotations show source.

- Hull base (lit top of fuselage, lit S-foil top): `#D8D2C4` **[memory]** — cream/dirty white. Correct for the weathered 1977 model, which was painted off-white and weathered with greys. Current SVG matches. **Keep.**
- Hull shadow (underside fuselage, S-foil underside): `#8D8678` **[memory]** — current. **Keep.**
- Hull stroke / panel ink: `#2A2620` **[memory]** — warm near-black, NOT pure black. The model has warm-grime panel washes; pure black would read flat. Current. **Keep.**
- Red Squadron stripe (Red Five / Red Leader / etc.): `#D6342A` recommended **[memory]**, vs. project's current `#FF3030`. The actual ANH decals are a slightly cooler scarlet — a touch dust-toned. `#FF3030` is the saturated Rebels-era reading and is also defensible as a homage choice (it matches `design.md`'s "laser red"). Pick one and commit; don't mix.
- Cockpit canopy glass: `#1A3A52` body, `#0A1A2A` rim, `#6DA5C8` highlight **[memory]** — dark teal-blue with a single specular streak. Current. **Keep.**
- R2 dome: `#E7E2D6` (whiter than hull — intentional), blue quarter `#3A8DD8`, eye dot `#FF3030` **[memory]**. R2 reads brighter than the hull because his finish is high-gloss vs. the hull's matte weather. Current. **Keep.**
- Engine glow halo: `#9FE9FF` **[design.md canon]** — slightly cool. The 1977 engine glows are warmer cyan tipping toward white; the cel-shaded Rebels reading pushes them more saturated cyan. `#9FE9FF` is the right project-palette compromise. **Keep.**
- Engine glow hot core: `#FFFFFF` **[memory]** — current. **Keep.**
- Engine bell rim: `#2A2620` (matches hull stroke) **[memory]** — current. **Keep.**
- Wingtip cannons: `#2A2620` / `#3A342C` two-tone **[memory]** — current. **Keep.**

## X-Wing geometry (recommended)

- **S-foils:** open X-attack position. Each pair opens ~25–30° from horizontal, so the open X has ~50–60° between upper and lower foils on each side. Current polygon offsets (`-44`/`-36` upper, `+36`/`+44` lower) read correctly at viewer scale. **[memory] — verify with orthographic plate next pass.**
- **Wingtip cannons:** four total, one per wingtip. Length ≈ 34px against ~120px overall ship width = ~28% of wing span. Canonical cannon-to-wing ratio is ~1:3. Current. **Keep.**
- **Nose taper:** fuselage narrows from `(36,−8)/(36,+8)` to a point at `(60,0)` — a ~24px nose cone, ~20% of fuselage length. Current. **Keep.**
- **R2 dorsal dome:** at `(−12,−9)`, ellipse 8×6, ~13% of fuselage length, slightly forward of center on the dorsal spine, between cockpit and engine cluster. Current. **Keep.**
- **Engine cluster:** four engines stacked vertically at `x=−58`, spaced 18px on center, 16px glow radius. The vertical-line stack reads "X-Wing" instantly because all four are visible from this 3/4 rear angle. Current. **Keep.**
- **3/4-rear viewer angle:** at this attitude the viewer should see all four engines, full cockpit canopy in profile, dorsal R2 silhouetted against space, and the red stripe on the **upper inner face** of each S-foil. Underside of the fuselage stays in shadow (`#8D8678`). Current rendering is consistent with this. **Keep.**

## Yavin gas giant palette (recommended)

> **Open question — verify on next pass:** Yavin Prime in canon is described in some sources as **green-banded** (consistent with McQuarrie's earliest paintings and with the in-film color-grade once the Falcon arrives at the Yavin system) and in other sources as **orange/tan-banded** (some video-game and 2010s-era reference material pushes Jupiter-tan). The project's current SVG commits to green, which matches the McQuarrie tradition and is also what `launch.html` already does. **The recommendation is to KEEP green** — it is more defensible than tan and gives the scene a chromatic counterpoint to the cool Death Star. But verify against a McQuarrie plate if you can download one.

Values below are calibrated for the green reading.

- Light side core (highlight on day side): `#A8E8B8` **[on-disk: matches current SVG `yavin-grad` 0%]**. **Keep.**
- Mid-tone band (dominant body color, "this is Yavin" hue): `#6FC88A` **[current 30% stop]**. **Keep.**
- Dark band / shadow break: `#2F7A4A` **[current 60% stop]**. **Keep.**
- Deep shadow (night-side limb): `#0A2818` **[current 100% stop]**. **Keep.**
- Atmospheric haze ring: `#9FE9B8` **[current haze stroke]**, 1.5px stroke at 30% opacity. **Keep.**
- Cloud bands: alternating `#A8E8B8` (bright) / `#6FC88A` (mid) / `#2F7A4A` (dark) / `#0A2818` (deep). The current `band-1`/`band-2`/`band-3` gradient stack does this. **Keep ordering, see deltas for spacing.**
- Terminator strip: pure value transition, white 10% → black 0%. **The terminator is SOFT, not hard like the Death Star** — gas giants have atmospheric scatter that diffuses the day/night boundary. Current `terminator` linear gradient is correct in concept; see delta #6 for tuning.

## Death Star palette (recommended)

The Death Star reads as a **cool grey, NOT warm.** **[memory]** In ANH establishing shots the lit hemisphere falls in the `#9AA1A9`–`#B8BDC4` band; the unlit hemisphere falls to `#3F464D`–`#2C3138`. Rebels-era cel banding pushes the highlights brighter and the shadows darker, with hard cel breaks. The current SVG uses cool greys with cel-banded radial-gradient hard-stops, which is correct.

- Lit-rim highlight (smallest band, edge of lit limb): `#B8BDC4` **[current `ds-grad` 0–22%]**. **Keep.**
- Lit mid-tone (largest visible band): `#9AA1A9` **[current 22.5–48%]**. **Keep.**
- Lit shadow band: `#6E7780` **[current 48.5–72%]**. **Keep.**
- Terminator cel-break: `#3F464D` **[current 72.5%]** — the hard cel step between lit and unlit hemispheres. **Keep.**
- Unlit hemisphere base: `#2C3138` **[current 100% / dark hemisphere fill]**. **Keep.**
- Hard terminator vertical strips: `#1A1D22` (inner) and `#0A0C10` (deepest) **[current]**. **Keep.**
- Equator trench: `#1A1D22` (1.4px) and `#3F464D` (0.8px sub-band) **[current]**. **Span and dark-side visibility need fixing — see delta #3.**
- Superlaser dish: outer rim `#3F464D`, inner basin `#2C3138`, ring highlight `#6E7780`, center pip `#1A1D22` **[current]**. Cel-correct concentric rings. **Keep.**
- Atmospheric haze ring just outside silhouette: current is `#9FAFD0` 30% then 18% — slightly purple. The cleaner cool blue-grey reading is `#A8B4C4` **[memory]**. Optional nudge.

**Surface character:** in establishing shots the Death Star reads as **smoothly paneled, not greebled**, at this scale — the surface greebling only becomes visible during the trench-run approach. At the `r=240` silhouette in this scene (across a 1920-wide canvas the Death Star is about 25% of frame height), individual greebles would be sub-pixel. The current SVG correctly treats the surface as smooth bands with one trench line and one dish indent. **Keep.**

## Star backdrop

- Deep space backdrop: 5-stop radial from `#0C1428` (lower-center, slightly warm-blue) → `#060A1C` → `#050514` → `#020208` → `#000000` **[current]**. The slight blue tint at center is correct — it prevents the "flat black" look. **Keep.**
- Star color: `#F5F5F5` **[design.md canon]**. **Keep.**
- Star sizes: 0.5–2.1px radius, 280 stars across 1920×1080 **[current]**. Slightly sparse in the empty quadrants — see delta #8.
- Top ~30 brightest stars get 4-point cross-flares (length 4–10px, 0.6 stroke, 55–90% opacity) **[current]**. This is the single most effective "this is space, not a sky" cue. **Keep.**
- Nebulae: two stains, magenta `#FF5FBF` and teal `#5FE6DC`, each blurred 60px at 30% opacity **[current]**. **This is Clone Wars / Rebels vocabulary, not 1977 ANH** — ANH space scenes have no visible nebulae. The decision is intentionally homage-not-replica; keep it but cap opacity at 0.30 max so it doesn't fight the Yavin green.
- No nebula in the upper-right quadrant where the Death Star sits — keep that area dead-black so the silhouette reads. **[current — it just happens that the magenta cloud is at (380, 280) and the teal at (1340, 380), both clear of the (1700, 200) Death Star centre. Confirm at next layout pass.]**

## Composition

- **X-Wing lead:** flies the curve from lower-left `(-200, 820)` → middle `(1000, 560)` → upper-right `(2120, 120)` over 4.6s, autorotated along the path. Banks +15° at t=2.8s for 0.7s (the canonical "stay on target" roll). **[current]**
- **Wingmate:** trails on a parallel offset path, `(-300, 920) → (920, 660) → (2020, 220)`. Starts 0.1s later, scaled 0.7, ~30% smaller and ~80px lower-left. Reads as Red Squadron formation reduced to two ships for screen economy. **[current]** Consider a third even-smaller wingmate (scale 0.5) if frame economy allows — see delta #10.
- **Yavin:** lower-right, planet centre at `(1500, 1500)` r=900, so only the upper-left hemisphere arcs into frame from below. Lit crescent runs along the upper-left limb facing the off-screen sun. **[current]** Correct.
- **Death Star:** upper-right, centre `(1700, 200)` r=240. Slowly fades in t=1s → t=3s (peak 0.92 opacity), drifts -20px / -10px over the full 6s for parallax. **[current]** Correct.
- **HUD:** lower-left cyan chip with `[ ]` bracket corners, 560px wide. Mini-radar 160×160 lower-right. Both fade in t=1.6s and t=1.9s. **[current]**
- **HUD-vs-ship guard rule:** the X-Wing's curve runs roughly diagonal across the HUD's top-right, peaking near `(1000, 560)` at t≈2.5s. The HUD chip bottoms out at y=960 (1080−120), so the ship clears it by ~400px at peak. Good. **[current]**

## Concrete deltas (recommended changes, prioritized)

These all flow from the discrepancies between current SVG and source-material memory. Each cites the line / value in `launch.html` to change.

1. **Red Squadron stripes — drop from doubled to single per wing.** Current rig (lines 274–277 wingmate, 414–417 lead) draws two parallel red bars per wing (`y=−42, y=−34` and `y=32, y=40`). **Canonical Red Five has a SINGLE thicker stripe per wing**, not a pair. Render as one 4px-tall bar per wing instead of two 3px bars, centred on the wing root: `y=−38` and `y=36`. This is the highest-priority fix because it's the most visually identifiable error from the source material. **[memory — verify against a Red Squadron still next pass]**

2. **Cool the red stripe slightly (optional).** `#FF3030` is hot for cel; `#D6342A` matches the dust-toned scarlet of the ANH decals and reads better against `#D8D2C4` cream hull. Skip if you want to keep `#FF3030` for `design.md` consistency with laser bolts.

3. **Death Star equator trench dark-side visibility.** Current trench lines (launch.html lines 93–96) run `x1=1460 x2=1940` and are clipped to `ds-disk-clip` so they stop at the silhouette — good. But on the **dark hemisphere** (right of the terminator strip at x=1700), the trench is currently invisible: a 1.4px stroke `#1A1D22` over the `#2C3138` shadow base = ~5% contrast. Boost the dark-side trench to `#0A0C10` so the equator stays readable across the terminator. Easiest implementation: split the trench into two `<line>` elements, one for the lit half (`x2=1700`, current `#1A1D22`) and one for the dark half (`x1=1700` `x2=1940`, `#0A0C10`).

4. **Death Star superlaser dish position — verify.** Currently at `(1640, 130)`, which puts it ~30° from the lit-hemisphere pole. The canonical position is **upper-third of the lit hemisphere, NOT crossing the equator and NOT touching the terminator strip**. At r=50 dish radius the dish edge sits at x=1690 — the terminator strip is at x=1700, so the dish narrowly clears it. **Keep, but if the dish is later scaled up, watch the terminator clearance.**

5. **Yavin band density — bump from 6 to 7 bands.** Current SVG (lines 178–183) has 6 ellipse bands at y=1180 / 1320 / 1460 / 1580 / 1720 / 1860. Add a thin highlight band at y=1240 (`band-1` style, opacity 0.55, ry=14) to break up the largest gap (140px between y=1180 and y=1320). Real gas giants have *more* bands than fewer; the eye reads density as planetary scale. **[memory — gas-giant atmosphere reference]**

6. **Yavin terminator should be SOFTER than Death Star's.** Current rig draws a `terminator` linear gradient strip at `x=1280, w=60` over a 1800-tall rect (line 186). Drop the width from 60 to 90 and lower opacity from 0.8 to 0.6 so the day/night transition feels atmospheric, not knife-edged. The Death Star is the hard-cel object in this scene; Yavin should be the *soft* one. The contrast between them is part of the visual story. **[memory — atmospheric scatter on gas giants vs. airless metal sphere]**

7. **Engine glow — add one warm-white core flicker.** Current has `engine-core` (white) flickering on `engine-glow` (cyan halo). Good. Add a tiny warm-white pip at r=2px, fill `#FFE6B0`, to suggest plasma heat *inside* the cyan envelope. Cel reading: cyan halo + white core + warm pip. Implementation: append a fifth `<circle>` per engine inside `xw-engine-cores` group at the same cx/cy with r=2, fill `#FFE6B0`, opacity 0.85. **[memory — the 1977 engine ports glow with a hot inner spike, not pure cyan-on-black]**

8. **Star density — boost in the upper-right quadrant.** With 280 stars evenly distributed via `mulberry32(0x5ca1ab1e)`, the Death Star quadrant (which fades in from t=1s) reads visibly empty before the reveal. Easiest fix: a second pass after the main loop that places ~30 extra stars with `x = 1200 + rnd()*720, y = rnd()*400` so the area has presence before the Death Star arrives. **[on-disk: visual inspection of the existing seeded distribution]**

9. **X-Wing drop-shadow glow is too cyan.** Current rig (line 345) has `filter:drop-shadow(0 0 6px rgba(159,233,255,0.35))` on the entire `#xwing-bank` group — so the cream hull glows cyan, which is wrong (the hull is not the light source, the engines are). Either:
   - Drop the filter from `#xwing-bank` and apply it only to `#xw-engines`, OR
   - Change the colour to a warm off-white `rgba(220,210,180,0.20)` so the ship reads as sunlit by Yavin's distant star, not back-lit by its own engines.
   The first option is more correct; the second is more forgiving if the engines are dim during slow stretches.

10. **Wingmate should bank slightly later.** Lead banks at t=2.8s for 0.7s. Wingmate currently never banks — it just follows its parallel path. Add a +12° bank on `#xwing-wing-bank` at t=3.1s for 0.6s so the formation reads as *responding* to Red Leader's call rather than flying autonomously. Implementation: clone the lead-bank tween targeting `#xwing-wing-bank` with `rotation: 12` at `3.1s`, `rotation: 0` at `3.4s`. **[memory — Red Squadron formation discipline]**

---

## Open questions for the next pass (when network is restored)

1. **Yavin colour verification.** The strongest single open question. McQuarrie's earliest paintings (1975) push Yavin Prime green/teal-banded, and the in-film grade once the Falcon arrives is greenish. But some 2000s+ Lucasfilm reference material pushes Jupiter-tan/orange. The current SVG commits to green; verify against a McQuarrie portfolio plate or a remastered Blu-ray Yavin-arrival still.

2. **Red Squadron stripe count per wing.** Current SVG has TWO parallel stripes per wing; canonical Red Five (Luke's ship) has ONE thicker stripe per wing. This is delta #1 above. Confirm with any clean 3/4-rear still of an X-Wing in Red Squadron livery from 1977.

3. **Death Star equator trench position relative to the silhouette centre.** Currently drawn dead-on the equator (y=200, equal to the disk centre). Some ANH stills show the trench slightly *above* centre — possibly because the Death Star is shown from a slightly-below camera angle, possibly because the "north pole" of the Death Star isn't dead-vertical. Verify and tilt the trench by ~3–5° if a still confirms.

4. **Whether the lens-flare at t=2s is appropriate.** ANH Death Star reveals are *not* JJ-Abrams-flared; they're matte-cinematic. The current `#launch-lensflare` element introduces a horizontal anamorphic streak that may read as too modern. Consider dropping it, or replacing it with a brief star-flare on the Death Star's nearest limb (smaller, in-frame, cooler).

5. **Whether `#9FE9FF` (engine cyan) should warm to `#A8E8FF` for the launch scene.** The trench-scene STYLE.md flagged that Filoni-era cyan (`#9FE9FF`) is wrong for an ANH-1977 read on the targeting-computer HUD specifically (which should be amber-orange in 1977). For *engine glow*, however, `#9FE9FF` is correct in both eras — so the launch scene's HUD should remain cyan only if the project is committing to a Filoni-era cel-shaded read across all scenes. If `trench.html` is being reverted to amber, mirror the HUD shift in `launch.html` (lines 470–536 — every `#9FE9FF` stroke and fill on `#launch-hud` and `#launch-radar`). **This is a big decision; flag for the user before unilaterally changing it.**
