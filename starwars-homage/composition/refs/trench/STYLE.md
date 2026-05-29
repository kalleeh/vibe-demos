# Trench reference style guide (verified)

## Sources

> **External-image acquisition status: BLOCKED in this sandbox run.**
> All network egress was denied for this session — `curl`, `wget`, `python urllib`,
> `WebFetch`, and even local `ffmpeg` invocation against `film.mp4` returned
> permission denied. Only project-local image files were readable.
>
> So the "verified" sections below cite directly-observed values from the project's
> own existing trench render (`poster.jpg`), plus the currently-checked-in colour
> tokens in `trench.html`. Where a section calls on canonical 1977 production
> facts that I could not re-confirm from a downloaded still in this run, the
> section is explicitly tagged `UNVERIFIED — production canon`. The next time
> this brief is run with network access, the failed downloads listed below
> should be retried and these tags should be replaced with per-image cites.

| File | What it is | Status |
|---|---|---|
| `../../../poster.jpg` | Current homage poster — direct multimodal read in this session. Shows the cyan-HUD trench composition we are critiquing. Used as a *delta target* (what we are now), NOT as a 1977 reference. | **READ OK** (verified, this session) |
| `../../snapshots/frame-00-at-17.0s.png` | Sunset binary-suns scene snapshot. Not relevant to trench, included only to confirm palette discipline elsewhere. | Read OK (off-topic) |
| `../../compositions/trench.html` | Current SVG source — the colours grepped here are the live tokens we want to replace. Cyan `#9FE9FF` confirmed throughout HUD, `#FF3030` for target-lock red, `#050810`/`#2a323d` for TIE silhouette. | Read OK (this session) |
| 1977 ANH trench-run cockpit-POV stills (`static.wikia.nocookie.net/starwars/...`) | Targeted: "Battle of Yavin", "Targeting computer", "Death Star (1977)", "Trench run". | **failed: network egress denied** |
| `upload.wikimedia.org` Death Star surface plating photos | Targeted with the prescribed UA header. | **failed: network egress denied** |
| Star Wars Rebels / Clone Wars cockpit-POV cel-shaded stills (cyan-HUD comparison) | Filoni-era reference for the alternate palette. | **failed: network egress denied** |
| TIE Fighter silhouette geometry refs | Wookieepedia infobox image. | **failed: network egress denied** |
| Exhaust port / proton torpedo strike frame | The white-flash beat. | **failed: network egress denied** |
| ILM 1976 trench miniature photographs (greebling reference) | Behind-the-scenes plate stills. | **failed: network egress denied** |

**Verified image count this session: 1** (`poster.jpg` — the project's own current state, used as the negative reference / delta target). Zero external 1977-canon stills were downloaded.

---

## VERIFIED targeting computer HUD palette

> **This subsection mixes one verified observation (current cyan in the project) with
> production-canon facts about 1977 ANH that I could not re-verify from a fresh
> still in this run.**

### Observed in `poster.jpg` (verified this session)

The current homage uses a **cyan** HUD on near-black, with red-only for the lock-acquired alert. Direct readings from the poster pixels:

- Reticle / corner brackets / wireframe stroke: cyan, approximately `#9FE9FF` (corroborated by grep of `trench.html`)
- Box frame around target zone: same cyan `#9FE9FF`, ~50% opacity over near-black
- Steady text ("EXHAUST PORT — 2M", "STAY ON TARGET", "RED FIVE", "DIST: 0.5KM"): cyan-white, `#9FE9FF` to off-white
- Alert text ("TARGET LOCK ACQUIRED"): saturated red `#FF3030`, with red underline tick marks
- Background pad behind the central reticle: a soft white-blue radial bloom, core nearly white with a `#9FE9FF`-tinted halo

### UNVERIFIED — production canon (1977 ANH)

The 1977 ANH targeting computer is **amber/orange**, not cyan. The pull-down screen Luke uses shows:
- Wireframe trench corridor in **orange phosphor** (~`#FF8A1C` warm, `#FFB347` highlights)
- Square reticle / crosshair: orange
- Top-row "TARGET" word: white, going red on lock
- Frame: matte black plastic
- Exhaust-port indicator dot scrolling down the corridor: white-on-black

The cyan/blue palette on cockpit HUDs entered the franchise via the Filoni era (Star Wars Rebels, Clone Wars). So the project's current cyan is canonical *for the Filoni era*, but reads wrong as an A New Hope homage. **This claim could not be verified from a downloaded 1977 still in this session — it is being carried forward from production-history knowledge, not from a frame I read multimodally this run.**

### Recommended ANH-faithful HUD palette (PRIMARY)

- Reticle / wireframe stroke: `#FF8A1C` (warm phosphor orange)
- Bright corner-bracket variant: `#FFB347` (already in project palette as "sunset apricot")
- Target-lock flash text: `#FF3030` (already correct, do not change)
- Frame / pad behind HUD glyphs: `#0A0A0A` near-black, slight transparency
- Steady readouts (DIST, RED FIVE, STAY ON TARGET): `#FFB347`
- Strobing alert words: `#FFFFFF`
- HUD secondary widgets: `#C76A18` (dimmer orange so the central reticle pops)

### Alternate Filoni-era cyan palette (if keeping the cel-shaded read)

- Reticle stroke: `#9FE9FF` (current — keep as-is)
- Frame: `#0A0A0A`
- Text: `#9FE9FF` / `#FFFFFF`

---

## Trench palette (UNVERIFIED — production canon)

These describe the 1977 ILM trench miniature as it reads on a remastered Blu-ray. The project's current `#1a222c` family is in the right neighbourhood; the values below are tuned slightly cooler and slightly more desaturated. Unverified in this run because external stills were not downloadable.

- Wall base (mid plate): `#2A3038`
- Wall mid (upper / lit band): `#3B434C`
- Wall shadow (recessed bottom band, alcove interiors): `#11151A`
- Panel-line stroke (engraved seam between plates): `#0A0D11`
- Floor (deep, almost black, faint grid): `#0A0E14`
- Highlight / rust accent (the orange "warning" stripe on a few surfaces): `#B8521E`
- Cool service-light cyan (occasional service lamp dots, NOT HUD): `#7FD8E6`
- Warning service-light red: `#E32A2A`

Notes: the trench reads as **near-monochrome cool grey, NOT blue**. R≈G with B only ~5% above gives the most neutral base.

---

## TIE Fighter silhouette

### Verified from `trench.html` source (this session)

The current `<symbol id="tie-shape">` encodes:
- Body / panels / pod fill: `#050810` (near-black) — **correct**
- Panel armature / seams stroke: `#2A323D` (dark cool grey) — **correct**
- Wing glow dots: `#FF3030` (red) at radius 3.5 — see note below
- Panel polygon: `points="-180,-90 -70,-90 -34,0 -70,90 -180,90"` — hexagonal, narrow vertical centre seam, wider at cockpit-facing edge. Aspect ratio ≈ 1:0.9 (height:width)
- Pod size: 60-unit pod across 360-unit total span ≈ **1:6 ratio**
- Pylon thickness: 6/180 ≈ **3.3%** of panel height

### UNVERIFIED — production canon (1977 ANH)

- Engine glow color: TIE engines glow **green-white / pale yellow-white** (`#C8FFE0` to `#E6FFE6`) from the *rear of the central pod*, NOT from the wings. The current red wing-glow dots read as muzzle-flash, not engine bloom. If those dots represent engines, recolour. If they represent turret muzzles, leave red.
- Pod-to-panel ratio in canon stills is closer to **1:3** (pod diameter ≈ one-third panel width). Current 1:6 reads slightly toyish — scale pod up by ~30% if it feels distant.
- Pylon thickness in canon is ~5% of panel height — bump current pylons from 6 units to 9-10 units.

---

## Cockpit framing

### Verified from `trench.html` source

- Frame fill: `#0A0A0A` to `#0E0E12` near-black (correct)
- Side strut width: `120/1920 ≈ 6.25%` of frame width (correct)
- LED row uses cyan + amber mixed dots (correct cool/warm contrast)

### UNVERIFIED — production canon

- X-wing canopy yoke shape from interior is **trapezoidal-with-curved-bottom**: top edge flat-with-angled-corners, bottom a wide shallow U (dashboard rises, then throttle/joystick well dips). Current path data captures this.
- Top frame in 1977 occupies roughly 20-25% of upper viewport edge. Current is ~140/1080 = 13% — slightly thin; consider 180-200px on a 1080-tall canvas.
- Below the bottom frame: a strip of dim greys studded with cyan + amber LEDs and one or two small **CRT-green** readouts (the targeting computer is the only orange one). Adding a tiny green readout would nail the "rec-room of glowing lights" look.

---

## Motion / kinetic feel (UNVERIFIED — production canon)

The 1977 trench rushes via **hard parallax with no motion blur** — ILM shot the miniature at 96 fps and printed back to 24 fps, so the result is sharp-but-jittery, never smeared.

- **No CSS blur on streak lines.** Current scene already complies — keep it.
- **Streak length is short, not long.** ANH motion-streaks are blips, not lightspeed-tunnel lines. Each streak ~8-15% of viewport diagonal, not corner-to-corner.
- **Streak count high, individual life short.** ANH reads more like ~40-60 visible streaks at any moment, each lasting ~150-300 ms before recycling. Current scene has ~24 streaks with 0.4-0.8 s lifetimes.
- **Vanishing-point glow stays WHITE/clipped, not coloured.** The bright tunnel-end is hot white-orange, no cyan. Current `#FFFFFF → #9FE9FF` should be `#FFFFFF → #FFE9C8 → transparent`.
- **Camera shake on hits is small + brief.** Current 4-6 px offsets at 0.07-0.15 s are correct.
- **No barrel distortion.** Standard rectilinear lens — do not add fisheye.

---

## Composition (UNVERIFIED — production canon, partially verified from poster.jpg)

### Verified from poster

- **Reticle sits dead centre** at the vanishing point — confirmed in poster, scene targets centred frame.
- **Distance readout sits low-left** — confirmed at approximately (220, 860) on a 1920×1080 canvas.

### UNVERIFIED — production canon

- **Laser bolts converge ON the trench centreline, not toward the camera.** Imperial turret fire originates from off-screen turrets above/behind cockpit FOV and streaks past into the trench distance. Current code's translation toward (0,0) reads correctly.
- **Cockpit framing scale ~25-30% of viewport perimeter.** The 1977 canopy eats more frame than a modern cinematic cockpit shot.
- **TIE pursuit enters from upper hemisphere** (above centreline) and tracks downward, often passing close on either side before peeling away. Repositioning `tie-1` from (960, 540) to start around (960, 380) and drift toward (960, 480) would read more like Vader's "I'm on the leader" approach.
- **Exhaust port scale at lock is small** — about 4-6% of viewport width. Current 44 px on 1920 = 2.3% (slightly small), consider doubling to ~80 px.

---

## Concrete deltas (mixed: verified from `poster.jpg` + production canon)

What our trench scene should change to match ANH-1977 instead of Filoni-era cel-shading:

1. **(verified the current state is cyan)** Switch the targeting-computer HUD from cyan (`#9FE9FF`) to amber-orange (`#FF8A1C` strokes, `#FFB347` text). This is the single biggest read-shift. Verified: `poster.jpg` shows cyan everywhere; `trench.html` grep confirms `#9FE9FF` on every HUD `<g>` (six text spans + four widget groups). [verdict on TARGET color is unverified — production canon, not from a downloaded still this run]
2. **(unverified — production canon)** Recolour the vanishing-point glow from `radial(#FFF → #9FE9FF)` to `radial(#FFF → #FFE9C8 → transparent)` (warm white, not cyan).
3. **(unverified — production canon)** Recolour motion streaks from cyan `#9FE9FF` to warm white `#FFE9C8` or `#FFFFFF` at lower opacity. Cyan streaks were never in ANH.
4. **(unverified — production canon)** Shorten and multiply motion streaks — clip individual length to ~15% of viewport diagonal, increase count from 24 to ~50, drop average lifetime from ~0.6 s to ~0.25 s for ILM-fast read.
5. **(unverified — production canon)** Desaturate the trench wall mid-tone from `#1a222c` to `#2A3038` (less blue, more neutral grey) so a new orange HUD pops cleanly.
6. **(verified the current size)** Bump the exhaust-port frame from 44 px to 80-90 px in the final approach so it reads as a target, not a dot. Current source confirmed 44 px (`<rect ... width="44" height="44">`).
7. **(verified the current frame thickness)** Thicken the cockpit top-frame yoke from ~140 px to ~180 px on the 1080 canvas. Production-canon reasoning is unverified, but the current thinness is verifiable from source.
8. **(verified)** Keep cockpit instrument LEDs in their current cyan/amber mix. Don't recolour everything orange — the cool/warm contrast between cockpit lights and the central HUD is what makes the orange HUD read as a *screen overlay* rather than a recolour. Current cyan + amber LED mix verified in poster pixels and in source.
9. **(unverified — production canon)** TIE engine wing-glow dots: switch to green-white (`#C8FFE0`), not red, IF those represent engine emissions. If they represent turret muzzles, leave red.
10. **(verified)** Leave the camera-shake offsets, the chromatic-shadow cockpit on hits, and the final white flash exactly as they are — those beats are already authentic to the ILM aesthetic and read correctly in the current poster.

---

## Recommended reticle color

**FINAL VERDICT (caveated): `#FF8A1C` warm phosphor orange — faithful to 1977 ANH.**

Reasoning:
- The brief explicitly asks "1977 original is amber/orange — confirm". Production-history knowledge says yes.
- BUT this verdict could NOT be confirmed by reading a 1977 still multimodally in this session (network egress denied; no canonical stills downloaded).
- The CURRENT project is cyan `#9FE9FF` (verified by direct read of `poster.jpg` and grep of `trench.html`). The current cyan is correct for a Filoni-era cel-shaded read but reads wrong as an A New Hope homage.

If the homage is intended as **A New Hope (1977)**: use `#FF8A1C` reticle stroke + `#FFB347` text + `#FF3030` lock-alert.
If the homage is intended as **Rebels / Clone Wars / sequel-era**: keep the current `#9FE9FF` cyan.

**Strong recommendation: orange.** "Stay on target. STAY ON TARGET." reads as 1977 to anyone who knows the film, and the orange-on-near-black phosphor-CRT look is one of the franchise's most recognisable visual signatures. The cyan we currently have is good craftsmanship aimed at the wrong era.

---

## Open questions for the next pass (with network access)

1. **Re-verify the orange HUD claim** with at least two downloaded 1977 stills (Luke's pull-down screen + a wide cockpit shot showing the screen in context).
2. **Wireframe density on the targeting-computer screen.** Best-guess: 6-8 perspective lines plus a single descending torpedo-path indicator. Confirm from a still.
3. **Whether ANH cockpit-POV shots show any TIE wing-glow at all,** or all visible TIE light comes from the rear-of-pod sublight. Current red wing-glow dots may be pure invention.
4. **Exhaust-port lighting on final approach.** Is there a hot-white core, or does the port read as a recessed black square against panel-lit walls? Production photos go both ways depending on the cut.
