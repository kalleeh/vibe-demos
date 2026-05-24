# Future demo ideas

A queue of vibe-demos to build. Each has enough detail to pick up on a future session without re-pitching.

**Audience:** the user's Korean friends. One works at a hagwon (학원, private academy/teacher); one works at a Korean government-adjacent "gas" utility — likely **KOGAS (한국가스공사)** or similar. The demos should show both how *cool* AI/web can be and how *practically useful* it can be in their work, so the queue mixes flashy 3D/animation pieces with productivity tools.

**Tech baseline:** plain static HTML/CSS/JS, hosted on GitHub Pages. WebGL via Three.js (CDN, no build step). For demos that need an LLM, default to the Claude API via a small client-side fetch with a key the user supplies at runtime (kept in `localStorage`, never committed) — or stub with canned realistic outputs first and wire the key later.

Status legend: `🟡 queued` · `🟠 in progress` · `🟢 shipped` · `⚪ shelved`

---

## WOW factor — 3D / WebGL / scroll

### 01 · 가스의 여정 — A Molecule's Journey 🟡 queued

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

### 03 · Hangul Particle Type 🟡 queued

Type Korean (or Roman) text and the glyphs assemble from ~50,000 GPU particles in 3D space. Each character explodes apart and reforms into the next as you type.

- **Tech:** Three.js `Points` with custom vertex shader; sample text-to-canvas to get particle target positions per character; lerp between targets.
- **Interactions:** input field at top; preset words (이름, 사랑, 가스, 학원, 안녕); click background to scatter.
- **Audience hook:** Both friends will type their own names and screenshot it. Shareable as hell.
- **Slug:** `hangul-particles`
- **Scope estimate:** medium. The particle-target sampling is the trick.

---

## AI productivity — useful, not just pretty

### 04 · Energy Bill Sense-Maker 🟡 queued

Paste a Korean utility bill (gas/electric/water — any format, OCR'd or copy-pasted text), Claude extracts line items, flags anomalies, suggests savings, and produces a plain-language Korean summary.

- **Tech:** Single page. Textarea on the left, structured output on the right. Calls Claude API (Sonnet 4.6 or Haiku 4.5) with a structured-output system prompt. Optional file upload + Tesseract.js for OCR of photographed bills.
- **Output panels:**
  1. Parsed line-item table (charge type, amount, prior-month delta)
  2. Anomaly badges (e.g. "이번 달 가스 요금이 평균보다 32% 높습니다")
  3. One-paragraph plain-language summary in Korean + English toggle
  4. 2–3 actionable suggestions
- **Audience hook:** Directly speaks to the gas-utility friend. Real practical value.
- **Slug:** `bill-sense`
- **Scope estimate:** medium. API key handling needs a polite key-prompt UI.

### 05 · Meeting → Action Items 🟡 queued

Paste a meeting transcript (or capture live via Web Speech API), get a clean Korean + English action-item list with owners, deadlines, and decisions.

- **Tech:** Three modes — paste, upload `.txt`/`.vtt`, or live capture (`SpeechRecognition` API, `lang: "ko-KR"`). Claude API call with a strict JSON schema for action items.
- **Output:** Two columns (Korean / English), each item card has owner, due date if mentioned, and a citation snippet from the transcript.
- **Audience hook:** Useful for the hagwon teacher (parent meetings, faculty notes) AND any office worker.
- **Slug:** `meeting-actions`
- **Scope estimate:** small-medium.

### 06 · Hanja Explainer 🟡 queued

Hover or tap any Hanja (漢字) inside a Korean text passage and a card pops up with the character's meaning, on/kun-style readings, etymology, and modern usage. Includes a paste-your-own-text mode.

- **Tech:** Local Hanja dataset (small JSON, ~3k common characters) for instant lookups; falls back to Claude API for rare characters or fuller etymology paragraphs.
- **Interactions:** Hover card on desktop; tap-to-pin on mobile. "Explain this paragraph" button generates a Korean-only paraphrase (no Hanja) for older legal/academic texts.
- **Audience hook:** Tutoring/hagwon angle is strong; also useful for KOGAS internal documents that still mix Hanja.
- **Slug:** `hanja-explainer`
- **Scope estimate:** medium. Sourcing the Hanja dataset is the prep work.

---

## Hybrid — flashy AND useful

### 07 · Seoul ⇄ Stockholm Live Globe 🟡 queued

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

### W7 · Lagom — A Scrollytelling Essay

Long-form editorial essay on a Swedish concept (lagom, fika, allemansrätten…). Real scroll-driven typography animations, illustration sequences pinned to scroll. Demonstrates editorial chops, not just toys.
- **Slug:** `lagom-essay` · **Scope:** large.

---

## Recommended ship order (subject to change)

1. **01 — Molecule's Journey** — emotional + 3D + directly hits the gas-utility friend's world
2. **07 — Seoul ⇄ Stockholm Live Globe** — instant "is this live?" moment, broadest appeal
3. **04 — Bill Sense-Maker** — productive-AI counterweight that proves the magic is also useful
4. **03 — Hangul Particle Type** — shareable, high screenshot rate, low scope
5. then pick from the wildcards based on mood

## Notes for whoever picks this up next

- Whenever a demo here ships, move it to the works index in `index.html` per the maintenance contract in [CLAUDE.md](./CLAUDE.md), update README, and mark it `🟢 shipped` here with a link.
- If a pitch turns out to be a dud or scope-creeps too far, mark `⚪ shelved` with a one-line reason rather than deleting it — useful context for later.
- AI-powered demos: prefer to ship a stubbed-canned-output version first so the demo works without a key, then wire real Claude API calls behind a "use my key" toggle. Never commit a key.
