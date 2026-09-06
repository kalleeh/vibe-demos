# Future demo ideas

A queue of vibe-demos to build. Each has enough detail to pick up on a future session without re-pitching.

**Audience:** the user's Korean friends. One works at a haniwon (한의원, Korean traditional medicine clinic — 한의사/한약/침·뜸 territory); one works at a Korean government-adjacent "gas" utility — likely **KOGAS (한국가스공사)** or similar. The demos should show both how *cool* AI/web can be and how *practically useful* it can be in their work, so the queue mixes flashy 3D/animation pieces with productivity tools.

**Tech baseline:** plain static HTML/CSS/JS, hosted on GitHub Pages. WebGL via Three.js (CDN, no build step). For demos that need an LLM, follow the **AI demo pattern** in [`.claude/rules/ai-demos.md`](./.claude/rules/ai-demos.md) — calls go through the shared Bedrock proxy (`ai.pb.gurum.se`, proof-of-work gated, no key UI), `model: "opus" | "sonnet"`, non-streaming, canned-first/live-optional. Loading and progress UX rules live in [`.claude/rules/loading-ux.md`](./.claude/rules/loading-ux.md).

Status legend: `🟡 queued` · `🟠 in progress` · `🟢 shipped` · `⚪ shelved`

---

## WOW factor — 3D / WebGL / scroll

### 01 · 가스의 여정 — A Molecule's Journey 🟢 shipped → [/molecule-journey/](./molecule-journey/)

Scrollytelling 3D piece. The viewer scrolls and follows a single LNG molecule from an Incheon-style LNG terminal → through a national pipeline → into a Seoul kitchen stove flame.

- **Tech:** Three.js + GSAP ScrollTrigger (or vanilla `IntersectionObserver` + `scroll` events). Pinned scenes with camera dolly between them.
- **Scenes (5–6 chapters):**
  1. Tanker docking at terminal at dawn
  2. Cryogenic storage (–162 °C) — frosted tank interior
  3. Regasification + pressure regulation
  4. Underground transmission pipeline (pulsing flow line on a map of Korea)
  5. Distribution into a Seoul apartment
  6. Blue gas flame igniting under a 된장찌개 pot
- **Copy:** Korean primary, small English subtitle. Editorial typography pinned to scroll.
- **Audience hook:** Speaks directly to the gas-utility friend's day job; emotional + technical.
- **Slug:** `molecule-journey`
- **Scope estimate:** medium-large (1–2 sessions). Three.js scaffolding is the long pole.

### 02 · Aurora Borealis Simulator 🟡 queued

Full-screen real-time aurora over a stylised fjord skyline. Mouse moves the wind direction; scroll changes solar storm intensity (Kp index visual). Optional mic input makes it react to ambient sound.

- **Tech:** WebGL fragment shader (custom GLSL via Three.js `ShaderMaterial`, or pure `regl`). Perlin/simplex noise for ribbons.
- **Audio (optional):** `getUserMedia` + `AnalyserNode` → drives ribbon brightness.
- **Audience hook:** Pure eye candy. Sweden flavour without being twee.
- **Slug:** `aurora`
- **Scope estimate:** medium. Risk: getting the shader to look genuinely beautiful, not cheesy.

### 03 · Hangul Particle Type 🟢 shipped → [/hangul-particles/](./hangul-particles/)

Type Korean (or Roman) text and the glyphs assemble from ~50,000 GPU particles in 3D space. Each character explodes apart and reforms into the next as you type.

- **Tech:** Three.js `Points` with custom vertex shader; sample text-to-canvas to get particle target positions per character; lerp between targets.
- **Interactions:** input field at top; preset words (이름, 사랑, 가스, 한의원, 안녕); click background to scatter.
- **Audience hook:** Both friends will type their own names and screenshot it. Shareable as hell.
- **Slug:** `hangul-particles`
- **Scope estimate:** medium. The particle-target sampling is the trick.

---

## AI productivity — useful, not just pretty

### 04 · 한방 Intake Companion 🟢 shipped → [/intake-companion/](./intake-companion/)

Patient-intake assistant for Korean traditional medicine (한의원). The 한의사 dictates symptoms in real time — "요즘 잠을 잘 못 자고, 손발이 차고, 소화도 안 돼요" — and the screen renders a confident clinical brief.

- **Tech:** Web Speech API (`lang: "ko-KR"`) for live dictation, or paste/type. Claude call through the shared proxy per the [AI demo pattern](./.claude/rules/ai-demos.md). Strict JSON schema for the structured output. Side-by-side: raw narrative on left, structured brief on right.
- **Output panels:**
  1. Structured chief-complaint card (sleep, circulation, digestion, pain, energy) with severity + duration
  2. **변증** — Claude commits to a pattern (e.g. 비양허, 기허) with rationale tying back to symptoms
  3. **처방** — formula suggestion (e.g. 사물탕, 보중익기탕) with modification notes
  4. **경혈** — acupoint suggestions for 침 treatment, with anatomical context
  5. Suggested follow-up questions (3 things to ask next)
  6. Korean ↔ English toggle on the whole brief
- **Tone:** Full clinical confidence — no "참고용" hedging. These are demos, not products. The boldness *is* the wow.
- **Visual:** Soft cream + celadon palette, restrained editorial typography, animated progress (streaming text + thin gradient bar) per [Loading states](./.claude/rules/loading-ux.md).
- **Models:** `model: "opus"` by default for the wow run via the shared proxy; `"sonnet"` where cost/speed matters.
- **Audience hook:** Speaks directly to the 한의원 friend's daily work. Voice-in is the visible wow; the structured brief is the productive payoff.
- **Slug:** `intake-companion`
- **Scope estimate:** medium. Tight system prompt + JSON schema is the careful work; UI is small.

### 05 · Meeting → Action Items 🟡 queued

Paste a meeting transcript (or capture live via Web Speech API), get a clean Korean + English action-item list with owners, deadlines, and decisions.

- **Tech:** Three modes — paste, upload `.txt`/`.vtt`, or live capture (`SpeechRecognition` API, `lang: "ko-KR"`). Claude API call with a strict JSON schema for action items.
- **Output:** Two columns (Korean / English), each item card has owner, due date if mentioned, and a citation snippet from the transcript.
- **Audience hook:** Useful for the haniwon side (intake notes, staff meetings) AND any office worker.
- **Slug:** `meeting-actions`
- **Scope estimate:** small-medium.

### 05.5 · MBTI 16유형 — Korean MBTI Read 🟢 shipped → [/korean-mbti/](./korean-mbti/)

Korean MBTI test (28-question quick / 93-question full) plus an AI deep-read mode where Claude infers the writer's type from a free-form Korean text passage (diary, chat, SNS post). Uses Korean MBTI culture nicknames natively — 잔망 루피 (INFP), 곰돌이 푸 (ISFJ), 인싸 끝판왕 (ENFP), 청렴결백한 공무원형 (ISTJ).

- **Tech:** Self-contained `index.html`. Domain-tuned prompt with XML tags + canonical_types list of 16 Korean nicknames + errors_to_avoid (no Western clichés, no romanization, no hedging). Claude via the shared proxy per the AI demo pattern; canned-first/live-optional.
- **Audience hook:** Korean MBTI culture is its own dialect — generic AI MBTI readings read as obviously foreign. The nickname canon and "친구가 톡으로 너 ENFP 같아 하는 톤" calibration is the wow.
- **Slug:** `korean-mbti`
- **Scope estimate:** medium. Question wording + canned-result calibration was the careful work.

### 06 · Hanja Explainer 🟡 queued

Hover or tap any Hanja (漢字) inside a Korean text passage and a card pops up with the character's meaning, on/kun-style readings, etymology, and modern usage. Includes a paste-your-own-text mode.

- **Tech:** Local Hanja dataset (small JSON, ~3k common characters) for instant lookups; falls back to Claude API for rare characters or fuller etymology paragraphs.
- **Interactions:** Hover card on desktop; tap-to-pin on mobile. "Explain this paragraph" button generates a Korean-only paraphrase (no Hanja) for older legal/academic texts.
- **Audience hook:** Strong for the haniwon side — classical Korean medicine texts and prescription notes still lean heavily on Hanja (e.g. 補, 瀉, 氣, 血, 經絡); also useful for KOGAS internal documents that still mix Hanja.
- **Slug:** `hanja-explainer`
- **Scope estimate:** medium. Sourcing the Hanja dataset is the prep work.

---

## Hybrid — flashy AND useful

### 07 · Seoul ⇄ Stockholm Live Globe 🟢 shipped → [/live-globe/](./live-globe/)

Interactive 3D globe with Seoul and Stockholm pinned. Real-time: local time, weather, sunrise/sunset, daylight terminator sweeping across the surface, optional energy-grid load (real if a free API exists, otherwise plausible mock). Click either city for an AI-generated "what's happening right now" blurb in Korean + English.

- **Tech:** Three.js `SphereGeometry` with Earth texture + day/night shader split. `wmo.int`/Open-Meteo for free weather. Time/sunrise from `SunCalc.js`. Claude API for the live-blurb summaries.
- **Polish:** Subtle starfield, atmospheric rim light, clouds layer, draggable + auto-rotating with inertia.
- **Audience hook:** "Wait, is this live?" moment. Both friends will see their city glow.
- **Slug:** `live-globe`
- **Scope estimate:** large. Highest portfolio impact.

### 08 · Pipeline Risk Twin 🟡 queued

Interactive 3D cross-section of a gas transmission pipeline (Three.js). Sliders for pressure (bar), pipe age (years), soil moisture, ambient temp, recent seismic activity. Real-time gauge updates and a Claude-generated one-paragraph Korean plain-language risk explanation that updates as you adjust.

- **Tech:** Three.js scene with a sliced pipe model; CSS overlay for sliders + gauges. Debounced Claude API call on slider release; cached for repeated states.
- **Output:** Numerical risk score + colored ring + Korean paragraph explaining what's driving the score.
- **Audience hook:** Looks like an industry "digital twin" demo, immediately legible to a KOGAS engineer; secretly a teaching toy.
- **Slug:** `pipeline-twin`
- **Scope estimate:** large. Three.js + plausible engineering math is the work.

---

## Wildcards / nice-to-have

### W1 · Korean ↔ Swedish loanword mirror

A side-by-side interactive showing how Korean and Swedish both adopted English loanwords differently (커피 ↔ kaffe, 버스 ↔ buss, 컴퓨터 ↔ dator…). Type a word in either language, animated transformation between scripts, audio pronunciations.
- **Slug:** `loanword-mirror` · **Scope:** small.

### W2 · Train Departure Board

A fake live-updating SL (Stockholm) or Seoul Metro departure board. Pure CSS/JS. Animated split-flap digits. No real data, just plausible random destinations on a schedule.
- **Slug:** `departure-board` · **Scope:** small. Pure aesthetic flex.

### W3 · A Day in 24 Photographs

A virtual photo essay: 24 hand-illustrated SVG vignettes of Seoul or Stockholm, one per hour. Scrub a clock dial to move through the day; light, sound, and color shift accordingly.
- **Slug:** `24-photographs` · **Scope:** medium. SVG illustration is the long pole.

### W4 · Variable Type Specimen

A typographic playground. One huge Korean or Swedish word on screen; sliders for weight, optical-size, slant. Click anywhere to drop a new word at the cursor. Showcases variable fonts the way a foundry would.
- **Slug:** `type-specimen` · **Scope:** small-medium.

### W5 · Generative Cover Art Studio

Sliders for mood / density / palette / grain → a generative editorial cover updates live (SVG + noise). Export-as-PNG button. Genuinely useful for placeholder art.
- **Slug:** `cover-studio` · **Scope:** medium.

### W6 · Ambient Synth

Click-and-hold pads that play soft generative chords (Web Audio oscillators + reverb). Large concentric circles ripple to the audio. Calming, meditative, very loop-friendly on social.
- **Slug:** `ambient-synth` · **Scope:** small-medium.

### G1 · Resonans — A Sketchbook of Standing Waves 🟢 shipped → [/resonans/](./resonans/)

Calm physics game in a Nintendo-quiet, hand-drawn-on-cream-paper register. A graphite string is fixed at both ends; the player taps anywhere on it to inject a Gaussian pulse. Pulses propagate, reflect off the boundaries, and interfere. When the player finds the right rhythm and tap location for a chosen mode (n=1..5), the spectral content of the string locks onto that eigenmode — the line "inks itself in" with darker pencil and watercolor blooms appear at the antinodes, and a soft sine drone rises with the lock confidence.

- **Tech:** Self-contained `index.html`. Vanilla Canvas 2D for the sketch, real 1D finite-difference wave equation (~220 nodes, CFL-stable, gentle damping), Web Audio for drone + pluck.
- **Lock detection:** direct sine-projection onto modes 1..5; lock = (target-mode energy) / (total energy) × (string-is-actually-moving). EMA-smoothed so it doesn't flicker.
- **Vibe:** Cream paper, ruled lines, Caveat hand-script title, Fraunces body. Multi-pass jittered strokes for graphite feel. A pencil-bird perched on the right peg bobs with the string. No score, no timer, no fail.
- **Slug:** `resonans`
- **Scope estimate:** small-medium. Wave sim + hand-drawn rendering is the careful work; everything else is calm UI.

### G2 · Sketchwings — A Glide Across Pencil Hills 🟢 shipped → [/tinywings/](./tinywings/)

Tiny Wings reimagined in the cream-paper / graphite register of Resonans. A pencil-bird glides over rolling hand-drawn hills; tap on the downslope to dive (gain speed), release on the upslope to launch (gain air). Procedural sum-of-sines terrain, a slow day-into-night palette cycle that bookends each run, and a boost meter that recharges with airtime.

- **Tech:** Self-contained `index.html`. Vanilla Canvas 2D, multi-pass jitter strokes for the pencil feel. Mulberry32-seeded RNG so each "day" is deterministic. Analytic slope from the sum-of-sines so the bird surfs the curve cleanly.
- **Loop:** One-tap dive / release, perfect-launch detection (slope-aligned exit at peak speed), boost mid-air, day-into-night ends the run when full night falls. localStorage best distance + perfect-launch counter.
- **Slug:** `tinywings` · **Scope:** small-medium. Shipped same session as the Resonans tuning pass.

### W7 · Lagom — A Scrollytelling Essay

Long-form editorial essay on a Swedish concept (lagom, fika, allemansrätten…). Real scroll-driven typography animations, illustration sequences pinned to scroll. Demonstrates editorial chops, not just toys.
- **Slug:** `lagom-essay` · **Scope:** large.

---

## Recommended ship order (locked in)

1. **01 — Molecule's Journey** — emotional + 3D, hits the KOGAS friend's world
2. **07 — Seoul ⇄ Stockholm Live Globe** — instant "is this live?" moment, broadest appeal
3. **04 — 한방 Intake Companion** — productive-AI counterweight, hits the 한의원 friend
4. **03 — Hangul Particle Type** — shareable, high screenshot rate, low scope
5. then pick from the wildcards based on mood

## Notes for whoever picks this up next

- Whenever a demo here ships, move it to the works index in `index.html` per the maintenance contract in [CLAUDE.md](./CLAUDE.md), update README, and mark it `🟢 shipped` here with a link.
- If a pitch turns out to be a dud or scope-creeps too far, mark `⚪ shelved` with a one-line reason rather than deleting it — useful context for later.
- AI-powered demos: ship a canned-output version first so the demo works with no network, then wire live calls through the shared proxy behind a "Try live mode" toggle (see `.claude/rules/ai-demos.md`). The browser never holds a key — never build a key UI, never commit a key.

---

## Follow-ups from the 2026-09-05 quality sweep

Items the review/fix pass surfaced but deliberately left for a later session (each needs content, a design call, or a re-render rather than a code fix).

- **kids-bookshelf** — the 0–2 catalog is thin (42 titles, 23 of them 동물, one 공룡). Add real 보드북 titles to `scripts/kids-bookshelf/sources/*.json`; the scorer now prefers exact-age books but can't invent them.
- **contraption-lab** — `official-11`, `demo-saw-01`, `demo-circuit-01` win with zero parts placed (ball reaches the goal unaided); `demo-mouse-01` wins at 27.3 s of the 30 s limit. Redesign those four; see `contraption-lab/DESIGN.md`.
- **molecule-journey** — `ship-cargo.glb`, `pot-stew.glb`, `pot-stew-lid.glb` reference a missing `Textures/colormap.png`, so the ship renders untinted white. Ship the Kenney colormap PNG or add a `colormap` tone to `paintKenney`.
- **starwars-homage** — the cue is now audible but is the repo's own synthesized pad. Real music needs a HyperFrames re-render (`npm i` in `composition/`, `npm run render`) with a licensed/original score.
- **sweden-food-guide** — print-city mode's `display: revert !important` collapses `.grid` to one column, so the A4 spread prints single-column. Pre-existing.
- **changwon-homes** — basemap tiles are cross-origin and not SW-cached ("offline" = shell + data + markers). `thumbs/changwon-homes.jpg` still shows the old CARTO basemap and old colour scheme; refresh it (and bump root `sw.js` CACHE).
- **intake-companion** — canned cases 삼령백출산 and 천마구등음 show no herb section because the atlas lacks images for their herbs (산약·의이인·천마·구등…). Add herb images, not map entries.
- **korean-words** — Räkneord icon is 🧮 (Siffror already uses 🔢); confirm with the kids.
- **kids-bookshelf** — the share hash includes the free-text note (`n=`) so links reproduce exactly; drop it if that feels like a privacy leak.
- **clinic-admin** — `.demo-strip` "샘플로 시연" CTAs are `display:none !important` under `body.shell-v2` (`styles.css`), so samples only run via the welcome seed or palette; decide whether to restore or remove them. Tab 8 `.ics` SUMMARY still carries staff names (record export, like the XLSX); pseudonymise if wanted. OCR against real Tesseract is untested headless. Dead `.tab-btn` CSS rules remain in `styles.css`.
- **clinic-admin (after the 2026-09-06 journey rearchitecture)** — `guaranteeDeadlines()` uses a 7-day "expiring" window (KPI copy matches); consent → 자보 hand-off passes Tariff codes only (qty resets to 1, no name mapping onto fee-list items); appeal-draft print window not asserted in e2e; no ESLint config is committed (integrators ran eslint:recommended from the npx cache); the 자보 appeal window uses the 90-day 건보 placeholder at low confidence.
- **clinic-admin (real-use path, out of PoC scope)** — self-hosted pinned build, LLM 위탁계약 or on-prem model, server-side 접속기록 retention, PocketBase Tier-3 auth for the intake board. Listed honestly in the app's 개인정보 처리 현황 modal.
