# Star Wars Homage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `starwars-homage/` — a public vibe-demo that plays a ~38s HyperFrames-rendered cinematic homage to *A New Hope* (crawl → binary sunset → X-wing launch → trench run → title card) inside a thin PWA shell.

**Architecture:** A standalone HyperFrames project lives at `starwars-homage/composition/`. It produces `film.mp4` and `poster.jpg`. The demo entry point `starwars-homage/index.html` is a small PWA that frames and plays the MP4. Each scene is a sub-composition loaded via `data-composition-src`. Crossfades are handled at the root timeline. All randomness is seeded (`mulberry32`); the trench shader reads its scroll position from a GSAP-tweened uniform so the capture engine renders the same frames every time.

**Tech Stack:** HyperFrames 0.6.x (CLI: `npx hyperframes`), GSAP 3.14.x (incl. `MotionPathPlugin`), vanilla SVG, CSS 3D transforms, raw WebGL fragment shader. No Three.js. No build step on the served output.

---

## File Structure

Files this plan creates:

```
starwars-homage/                         ← demo (served on Pages)
├── index.html                           ← PWA shell with <video> player
├── manifest.webmanifest                 ← PWA manifest (cream/yellow theme)
├── icon.svg                             ← demo glyph
├── sw.js                                ← demo SW (vibe-starwars-homage-v1)
├── poster.jpg                           ← rendered title-card frame
├── film.mp4                             ← rendered HyperFrames output
├── audio.mp3                            ← public-domain orchestral cue
└── composition/                         ← HyperFrames project (committed, NOT served as demo)
    ├── package.json                     ← hyperframes CLI dep
    ├── design.md                        ← brand colors, fonts
    ├── index.html                       ← root composition (1920×1080, 38s)
    ├── .gitignore                       ← ignore audio.local.mp3, .hyperframes/, node_modules/
    ├── fonts/
    │   ├── star-jedi.woff2
    │   └── LICENSE.txt
    └── compositions/
        ├── crawl.html                   ← Scene 1
        ├── sunset.html                  ← Scene 2
        ├── launch.html                  ← Scene 3
        ├── trench.html                  ← Scene 4
        └── title.html                   ← Title card
```

Files this plan modifies:

- `index.html` (root) — works-index row, count, labels map.
- `README.md` — Live demos bullet.
- `IDEAS.md` — append a new "🟢 shipped" entry.
- `sw.js` (root) — only if its subpath-exclusion logic doesn't already exclude `/starwars-homage/`. Verify before editing.

---

## Important context for the executing engineer

You probably haven't worked with HyperFrames before. A 5-line orientation:

1. A "composition" is just an HTML file with `data-*` attributes for timing and a GSAP timeline registered on `window.__timelines["<composition-id>"]`. The framework auto-plays/pauses scenes based on `data-start` and `data-duration`.
2. Sub-compositions wrap their content in `<template>`. The standalone root `index.html` does **NOT** use `<template>` — content goes directly in `<body>`.
3. **Determinism is non-negotiable.** No `Math.random()`, no `Date.now()`, no `requestAnimationFrame`-driven state. Use a seeded PRNG (`mulberry32`) for every "random" decision.
4. **Animations:** elements get entrance animations (`gsap.from(...)`) only — never exit animations except on the very last scene. Scene transitions are handled by the root composition's track-level fades, not by emptying scenes via `gsap.to(opacity: 0)`.
5. CLI: `npx hyperframes preview` for live editing, `npx hyperframes lint` and `npx hyperframes inspect` to validate, `npx hyperframes render --output ../film.mp4` to produce the MP4. Working directory must be inside `composition/`.

The full skill lives at `~/.claude/skills/hyperframes/`. Reference techniques in `~/.claude/skills/hyperframes/references/techniques.md` (especially #13 WebGL shaders and #9 MotionPath).

---

## Task 0: Scaffold the demo folder and HyperFrames project

**Files:**
- Create: `starwars-homage/.placeholder` (will be removed)
- Create: `starwars-homage/composition/package.json`
- Create: `starwars-homage/composition/.gitignore`
- Create: `starwars-homage/composition/index.html`

- [ ] **Step 1: Create the demo folder**

```bash
cd /home/ubuntu/projects/vibe-demos
mkdir -p starwars-homage/composition/compositions starwars-homage/composition/fonts
```

- [ ] **Step 2: Initialize the HyperFrames project**

Run from inside `starwars-homage/composition/`:

```bash
cd starwars-homage/composition
cat > package.json <<'EOF'
{
  "name": "starwars-homage-composition",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "preview": "hyperframes preview",
    "render": "hyperframes render --output ../film.mp4 --quality medium",
    "lint": "hyperframes lint",
    "inspect": "hyperframes inspect"
  },
  "devDependencies": {
    "hyperframes": "^0.6.0"
  }
}
EOF
```

- [ ] **Step 3: Add a composition .gitignore**

```bash
cat > .gitignore <<'EOF'
node_modules/
.hyperframes/
audio.local.mp3
*.log
EOF
```

- [ ] **Step 4: Create a minimal root composition with a placeholder scene**

Write to `composition/index.html`. It declares the 38s root timeline and embeds a single black-screen scene we can render to verify the toolchain works end-to-end before building real content.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>A New Hope — vibe-demos</title>
  </head>
  <body>
    <div data-composition-id="root" data-width="1920" data-height="1080">
      <div
        id="placeholder"
        class="clip"
        data-start="0"
        data-duration="2"
        data-track-index="0"
        style="width:100%;height:100%;background:#000;color:#FFE81F;display:flex;align-items:center;justify-content:center;font-family:system-ui;font-size:96px;"
      >
        Hello, galaxy.
      </div>
      <style>
        body {
          margin: 0;
        }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
      <script>
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });
        tl.from("#placeholder", { opacity: 0, duration: 0.4, ease: "power2.out" }, 0);
        window.__timelines["root"] = tl;
      </script>
    </div>
  </body>
</html>
```

- [ ] **Step 5: Verify the toolchain runs**

```bash
npx hyperframes lint
```

Expected: `✓ No issues found` (or similar pass message). If lint complains, fix the reported issue before continuing.

- [ ] **Step 6: Render the placeholder to confirm end-to-end works**

```bash
npx hyperframes render --output ../film.mp4 --quality low
ls -lh ../film.mp4
```

Expected: a tiny MP4 (~50-200 KB) at `starwars-homage/film.mp4`. We will overwrite it later.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/
git commit -m "starwars-homage: scaffold HyperFrames composition project"
```

---

## Task 1: Demo shell HTML, manifest, icon, SW

**Files:**
- Create: `starwars-homage/index.html`
- Create: `starwars-homage/manifest.webmanifest`
- Create: `starwars-homage/icon.svg`
- Create: `starwars-homage/sw.js`

- [ ] **Step 1: Write the demo shell HTML**

Create `starwars-homage/index.html`. The shell is a single-page editorial frame around a `<video>` element. Idle = cream paper editorial card with title + play button on the poster. Playing = body goes black, video fills viewport. Ends → replay button + credit.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>A New Hope — an homage · vibe-demos</title>

    <link rel="icon" type="image/svg+xml" href="icon.svg" />
    <link rel="apple-touch-icon" href="icon.svg" />
    <link rel="manifest" href="manifest.webmanifest" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="A New Hope" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,600&family=JetBrains+Mono:wght@400&display=swap"
      rel="stylesheet"
    />

    <style>
      :root {
        --paper: #efe9dc;
        --ink: #1a1a1a;
        --accent: #b04a2f;
        --void: #0a0a0a;
        --crawl: #ffe81f;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        height: 100%;
        background: var(--paper);
        color: var(--ink);
        font-family: "Fraunces", Georgia, serif;
        -webkit-font-smoothing: antialiased;
      }
      body[data-state="playing"],
      body[data-state="ended"] {
        background: var(--void);
      }

      .stage {
        position: relative;
        width: 100%;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        transition: background 0.4s ease;
      }

      .card {
        max-width: 960px;
        width: 100%;
        text-align: center;
      }
      body[data-state="playing"] .card,
      body[data-state="ended"] .card .meta {
        display: none;
      }

      .eyebrow {
        font-family: "JetBrains Mono", monospace;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #6b6b6b;
      }
      h1 {
        font-family: "Fraunces", serif;
        font-weight: 600;
        font-size: clamp(48px, 9vw, 120px);
        margin: 12px 0 0;
        line-height: 0.95;
      }
      h1 em {
        color: var(--accent);
      }
      .lede {
        max-width: 560px;
        margin: 16px auto 28px;
        font-size: clamp(15px, 1.6vw, 18px);
        line-height: 1.55;
        color: #444;
      }

      .player {
        position: relative;
        width: min(960px, 100%);
        aspect-ratio: 16 / 9;
        margin: 0 auto;
        background: var(--void);
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.5);
      }
      body[data-state="playing"] .player {
        width: 100vw;
        height: 100dvh;
        max-width: none;
        border-radius: 0;
        box-shadow: none;
      }

      video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: var(--void);
      }
      video[data-show="false"] {
        opacity: 0;
        pointer-events: none;
      }

      .poster {
        position: absolute;
        inset: 0;
        background: var(--void) center/cover no-repeat;
        background-image: url("poster.jpg");
        display: grid;
        place-items: center;
      }
      body[data-state="playing"] .poster {
        display: none;
      }

      .play-btn,
      .replay-btn {
        appearance: none;
        border: 0;
        background: rgba(0, 0, 0, 0.55);
        color: var(--crawl);
        font-family: "JetBrains Mono", monospace;
        font-size: 14px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        padding: 18px 28px;
        border-radius: 999px;
        cursor: pointer;
        backdrop-filter: blur(6px);
        transition: transform 0.2s ease, background 0.2s ease;
      }
      .play-btn:hover,
      .replay-btn:hover {
        transform: translateY(-1px);
        background: rgba(0, 0, 0, 0.75);
      }

      .ended-overlay {
        position: absolute;
        inset: 0;
        display: none;
        place-items: center;
        background: rgba(0, 0, 0, 0.6);
      }
      body[data-state="ended"] .ended-overlay {
        display: grid;
      }

      .meta {
        margin-top: 28px;
        font-family: "JetBrains Mono", monospace;
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6b6b6b;
      }
      .meta a {
        color: inherit;
        text-decoration: none;
        border-bottom: 1px solid currentColor;
      }
      .meta a:hover {
        color: var(--accent);
      }

      @media (prefers-reduced-motion: reduce) {
        .play-btn::after {
          content: " (reduced motion)";
          opacity: 0.7;
        }
      }
    </style>
  </head>
  <body data-state="idle">
    <main class="stage">
      <article class="card">
        <p class="eyebrow">vibe-demos · 09</p>
        <h1>A New <em>Hope</em></h1>
        <p class="lede">A 38-second cinematic homage in four beats — opening crawl, binary sunset, X-wing launch, trench run.</p>

        <div class="player">
          <video
            id="film"
            preload="metadata"
            playsinline
            controls
            data-show="false"
            poster="poster.jpg"
          >
            <source src="film.mp4" type="video/mp4" />
          </video>

          <div class="poster">
            <button class="play-btn" id="play-btn" type="button" aria-label="Play film">
              ▶ Play film
            </button>
          </div>

          <div class="ended-overlay">
            <button class="replay-btn" id="replay-btn" type="button" aria-label="Replay film">
              ↻ Replay
            </button>
          </div>
        </div>

        <p class="meta">
          made with <a href="https://github.com/anthropics/claude-code" rel="noopener">HyperFrames</a> · <a href="../">back to works</a>
        </p>
      </article>
    </main>

    <script>
      const body = document.body;
      const video = document.getElementById("film");
      const playBtn = document.getElementById("play-btn");
      const replayBtn = document.getElementById("replay-btn");

      function play() {
        body.dataset.state = "playing";
        video.dataset.show = "true";
        video.currentTime = 0;
        video.play().catch(() => {
          body.dataset.state = "idle";
          video.dataset.show = "false";
        });
      }
      playBtn.addEventListener("click", play);
      replayBtn.addEventListener("click", play);
      video.addEventListener("ended", () => {
        body.dataset.state = "ended";
      });

      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("./sw.js").catch(() => {});
        });
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Write the manifest**

Create `starwars-homage/manifest.webmanifest`:

```json
{
  "name": "A New Hope — an homage",
  "short_name": "A New Hope",
  "description": "A 38-second cinematic homage to A New Hope, made with HyperFrames.",
  "lang": "en",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    {
      "src": "icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Write a distinctive icon**

Create `starwars-homage/icon.svg` — a tilted yellow planet/text-box silhouette referencing the crawl, on a black square. Keep it editorial.

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="A New Hope">
  <rect width="512" height="512" rx="96" fill="#0a0a0a" />
  <g transform="translate(256 320) rotate(-18)">
    <polygon
      points="-150,80 150,80 100,-80 -100,-80"
      fill="none"
      stroke="#FFE81F"
      stroke-width="14"
      stroke-linejoin="round"
    />
    <line x1="-90" y1="-30" x2="90" y2="-30" stroke="#FFE81F" stroke-width="10" stroke-linecap="round" />
    <line x1="-110" y1="10" x2="110" y2="10" stroke="#FFE81F" stroke-width="10" stroke-linecap="round" />
    <line x1="-130" y1="50" x2="130" y2="50" stroke="#FFE81F" stroke-width="10" stroke-linecap="round" />
  </g>
  <g fill="#fff" opacity="0.9">
    <circle cx="80" cy="120" r="2" />
    <circle cx="180" cy="80" r="1.5" />
    <circle cx="300" cy="110" r="2" />
    <circle cx="420" cy="90" r="1.5" />
    <circle cx="120" cy="200" r="1.5" />
    <circle cx="380" cy="180" r="2" />
    <circle cx="450" cy="240" r="1.5" />
  </g>
</svg>
```

- [ ] **Step 4: Write the demo service worker**

Create `starwars-homage/sw.js` — network-first for HTML, cache-first for assets, cache name `vibe-starwars-homage-v1`.

```js
const CACHE = "vibe-starwars-homage-v1";
const SHELL = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.webmanifest",
  "./poster.jpg",
  "./film.mp4",
  "./audio.mp3"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
```

- [ ] **Step 5: Verify the root SW excludes the new subpath**

Read `sw.js` (the root one) and confirm its fetch handler skips paths containing `/` after the scope root (per CLAUDE.md PWA shell pattern). It should look like:

```js
if (path.includes("/")) return; // belongs to a demo SW
```

If that line exists, no edit needed. If it doesn't, fix the root SW to add subpath exclusion before continuing — otherwise root will hijack `/starwars-homage/`.

- [ ] **Step 6: Verify the shell loads in a browser**

```bash
cd /home/ubuntu/projects/vibe-demos
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1
curl -sf "http://127.0.0.1:8765/starwars-homage/" -o /dev/null && echo "✓ shell loads"
curl -sf "http://127.0.0.1:8765/starwars-homage/icon.svg" -o /dev/null && echo "✓ icon loads"
curl -sf "http://127.0.0.1:8765/starwars-homage/manifest.webmanifest" -o /dev/null && echo "✓ manifest loads"
kill $SERVER_PID
```

Expected: three "✓ loads" lines.

- [ ] **Step 7: Commit**

```bash
git add starwars-homage/index.html starwars-homage/manifest.webmanifest starwars-homage/icon.svg starwars-homage/sw.js
git commit -m "starwars-homage: PWA shell with editorial idle + fullscreen player"
```

---

## Task 2: Source the Star Jedi font and license

**Files:**
- Create: `starwars-homage/composition/fonts/star-jedi.woff2`
- Create: `starwars-homage/composition/fonts/LICENSE.txt`

- [ ] **Step 1: Download the Star Jedi font**

The user (or whoever runs this plan) needs to do this manually because automated downloads from dafont.com are blocked. Open https://www.dafont.com/star-jedi.font in a browser, download the zip, and extract `Starjedi.ttf` (or `Starjhol.ttf` — Hollow variant works too).

Convert it to WOFF2 either with [google/woff2](https://github.com/google/woff2):

```bash
# from a local copy of the .ttf
woff2_compress Starjedi.ttf
mv Starjedi.woff2 /home/ubuntu/projects/vibe-demos/starwars-homage/composition/fonts/star-jedi.woff2
```

Or via the online converter at https://transfonter.org/ (set format to WOFF2, download).

Place the resulting `star-jedi.woff2` at `starwars-homage/composition/fonts/star-jedi.woff2`.

- [ ] **Step 2: Add the license file**

Star Jedi by Boba Fonts (Daniel Zadorozny) is freeware for non-commercial use. Save the license text alongside the font:

```bash
cat > /home/ubuntu/projects/vibe-demos/starwars-homage/composition/fonts/LICENSE.txt <<'EOF'
Star Jedi
Designer: Boba Fonts (Daniel Zadorozny)
Source: https://www.dafont.com/star-jedi.font

Freeware. Free for personal use. For commercial use, contact the designer.
This vibe-demos project uses the font for non-commercial homage purposes only.
EOF
```

- [ ] **Step 3: Verify the file exists and is non-empty**

```bash
ls -lh /home/ubuntu/projects/vibe-demos/starwars-homage/composition/fonts/star-jedi.woff2
```

Expected: a non-zero file size (typically 8-30 KB for this font).

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/fonts/
git commit -m "starwars-homage: vendor Star Jedi font + license"
```

---

## Task 3: design.md and root composition skeleton

**Files:**
- Create: `starwars-homage/composition/design.md`
- Modify: `starwars-homage/composition/index.html` (replace placeholder)

- [ ] **Step 1: Write the design.md**

```bash
cat > /home/ubuntu/projects/vibe-demos/starwars-homage/composition/design.md <<'EOF'
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
EOF
```

- [ ] **Step 2: Replace the placeholder root composition with the real wiring**

Overwrite `composition/index.html` to wire the five sub-compositions on five sequential time slots, with crossfade overlays between them. Total root duration: **38s** (14 + 8 + 6 + 8 + 2). Crossfades happen via a black overlay div on a higher track-index, fading in for 0.4s and out for 0.4s at each scene boundary; the scenes themselves overlap by 0.4s with the overlay so the cut is hidden.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>A New Hope — vibe-demos</title>
    <style>
      @font-face {
        font-family: "Star Jedi";
        src: url("./fonts/star-jedi.woff2") format("woff2");
        font-display: block;
      }
      body {
        margin: 0;
        background: #0a0a0a;
      }
    </style>
  </head>
  <body>
    <div data-composition-id="root" data-width="1920" data-height="1080">
      <!-- Scene 1: Crawl (0 → 14) -->
      <div
        id="scene-crawl"
        data-composition-id="scene-crawl"
        data-composition-src="compositions/crawl.html"
        data-start="0"
        data-duration="14"
        data-track-index="1"
      ></div>

      <!-- Scene 2: Sunset (14 → 22) -->
      <div
        id="scene-sunset"
        data-composition-id="scene-sunset"
        data-composition-src="compositions/sunset.html"
        data-start="14"
        data-duration="8"
        data-track-index="2"
      ></div>

      <!-- Scene 3: Launch (22 → 28) -->
      <div
        id="scene-launch"
        data-composition-id="scene-launch"
        data-composition-src="compositions/launch.html"
        data-start="22"
        data-duration="6"
        data-track-index="3"
      ></div>

      <!-- Scene 4: Trench (28 → 36) -->
      <div
        id="scene-trench"
        data-composition-id="scene-trench"
        data-composition-src="compositions/trench.html"
        data-start="28"
        data-duration="8"
        data-track-index="4"
      ></div>

      <!-- Title card (36 → 38) -->
      <div
        id="scene-title"
        data-composition-id="scene-title"
        data-composition-src="compositions/title.html"
        data-start="36"
        data-duration="2"
        data-track-index="5"
      ></div>

      <!-- Black overlay for crossfades -->
      <div
        id="fader"
        class="clip"
        data-start="0"
        data-duration="38"
        data-track-index="9"
        style="position:absolute;inset:0;background:#000;pointer-events:none;opacity:0;"
      ></div>

      <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
      <script>
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });

        // Crossfade shape: at each boundary we fade fader to 1, hold 0.05s, fade back to 0.
        // Boundaries (s): 14 (crawl→sunset), 22 (sunset→launch), 28 (launch→trench), 36 (trench→title).
        // Each crossfade window = 0.4s in + 0.4s out, centred on the boundary.
        const boundaries = [14, 22, 28, 36];
        for (const b of boundaries) {
          tl.to("#fader", { opacity: 1, duration: 0.4, ease: "power2.in" }, b - 0.4);
          tl.to("#fader", { opacity: 0, duration: 0.4, ease: "power2.out" }, b + 0.05);
        }

        window.__timelines["root"] = tl;
      </script>
    </div>
  </body>
</html>
```

- [ ] **Step 3: Stub out empty sub-compositions so lint passes**

Create five tiny stub files. Each is a valid `<template>`-wrapped composition with a single black background div and a registered timeline. We'll fill them in subsequent tasks.

For each of `crawl`, `sunset`, `launch`, `trench`, `title`:

```bash
for name in crawl sunset launch trench title; do
  cat > /home/ubuntu/projects/vibe-demos/starwars-homage/composition/compositions/$name.html <<EOF
<template id="scene-$name-template">
  <div data-composition-id="scene-$name" data-width="1920" data-height="1080" style="position:relative;width:100%;height:100%;background:#000;">
    <div id="$name-stub" class="clip" data-start="0" data-duration="1" data-track-index="0" style="width:100%;height:100%;"></div>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from("#$name-stub", { opacity: 0, duration: 0.1, ease: "none" }, 0);
      window.__timelines["scene-$name"] = tl;
    </script>
  </div>
</template>
EOF
done
```

- [ ] **Step 4: Lint**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes lint
```

Expected: pass.

- [ ] **Step 5: Render the wireframe to verify the timeline structure**

```bash
npx hyperframes render --output ../film.mp4 --quality low
ls -lh ../film.mp4
```

Expected: a 38-second mostly-black MP4. Open it briefly to confirm the four crossfade flashes at 14s / 22s / 28s / 36s.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/design.md starwars-homage/composition/index.html starwars-homage/composition/compositions/
git commit -m "starwars-homage: design.md, root timeline, scene stubs"
```

---

## Task 4: Scene 1 — The Crawl (14s)

**Files:**
- Modify: `starwars-homage/composition/compositions/crawl.html`

- [ ] **Step 1: Write the crawl scene**

Replace the stub with the full crawl. Black background, parallax SVG starfield (200 deterministic stars), prologue card "A long time ago in a galaxy far, far away…" in `#4BD5EE` (fades in 0.5s, out at 4.5s), then the yellow tilted crawl text rises from `+800px` to `-2400px` over 9s (5s → 14s).

```html
<template id="scene-crawl-template">
  <div data-composition-id="scene-crawl" data-width="1920" data-height="1080">
    <style>
      [data-composition-id="scene-crawl"] {
        position: relative;
        width: 100%;
        height: 100%;
        background: #000;
        color: #fff;
        overflow: hidden;
        font-family: "Helvetica Neue", Arial, sans-serif;
      }
      [data-composition-id="scene-crawl"] .stars {
        position: absolute;
        inset: 0;
      }
      [data-composition-id="scene-crawl"] .prologue {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #4bd5ee;
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-weight: 400;
        font-size: 56px;
        letter-spacing: 0.01em;
        text-align: center;
        line-height: 1.3;
        max-width: 1400px;
        opacity: 0;
      }
      [data-composition-id="scene-crawl"] .crawl-stage {
        position: absolute;
        inset: 0;
        perspective: 400px;
        perspective-origin: 50% 100%;
      }
      [data-composition-id="scene-crawl"] .crawl-text {
        position: absolute;
        top: 100%;
        left: 50%;
        transform-origin: 50% 0;
        transform: translateX(-50%) rotateX(25deg);
        width: 1100px;
        color: #ffe81f;
        font-family: "Star Jedi", "Times New Roman", serif;
        font-weight: 700;
        font-size: 58px;
        line-height: 1.45;
        text-align: justify;
      }
      [data-composition-id="scene-crawl"] .crawl-text h2 {
        text-align: center;
        font-size: 76px;
        margin: 0 0 0.6em;
        letter-spacing: 0.02em;
      }
      [data-composition-id="scene-crawl"] .crawl-text p {
        margin: 0 0 1.1em;
      }
    </style>

    <div id="crawl-clip" class="clip" data-start="0" data-duration="14" data-track-index="0" style="position:absolute;inset:0;">
      <svg class="stars" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"></svg>

      <div class="prologue" id="prologue">
        A long time ago in a galaxy<br />far, far away....
      </div>

      <div class="crawl-stage">
        <div class="crawl-text" id="crawl-text">
          <h2>Episode IV</h2>
          <h2>A NEW HOPE</h2>
          <p>It is a period of civil war. Rebel spaceships, striking from a hidden base, have won their first victory against the evil Galactic Empire.</p>
          <p>During the battle, Rebel spies managed to steal secret plans to the Empire's ultimate weapon, the DEATH STAR, an armored space station with enough power to destroy an entire planet.</p>
          <p>Pursued by the Empire's sinister agents, Princess Leia races home aboard her starship, custodian of the stolen plans that can save her people and restore freedom to the galaxy....</p>
        </div>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};

      // Deterministic PRNG.
      function mulberry32(a) {
        return function () {
          var t = (a += 0x6d2b79f5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      const rand = mulberry32(0xa11ce);

      const svg = document.querySelector('[data-composition-id="scene-crawl"] .stars');
      const NS = "http://www.w3.org/2000/svg";
      for (let i = 0; i < 200; i++) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(rand() * 1920));
        c.setAttribute("cy", String(rand() * 1080));
        const r = 0.6 + rand() * 1.4;
        c.setAttribute("r", String(r));
        c.setAttribute("fill", "#f5f5f5");
        c.setAttribute("opacity", String(0.4 + rand() * 0.6));
        svg.appendChild(c);
      }

      const tl = gsap.timeline({ paused: true });

      // Prologue: fade in 0.5s → 1.0s, hold to 4.0s, fade out 4.0s → 4.5s.
      tl.fromTo("#prologue", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.5);
      tl.to("#prologue", { opacity: 0, duration: 0.5, ease: "power2.in" }, 4.0);

      // Crawl rises from y=0 (offscreen below) to y=-3200px over 9s (starts at 5s).
      tl.fromTo(
        "#crawl-text",
        { y: 0 },
        { y: -3200, duration: 9, ease: "none" },
        5
      );

      // Subtle starfield drift over the full 14s.
      tl.fromTo(
        '[data-composition-id="scene-crawl"] .stars',
        { y: 0 },
        { y: -20, duration: 14, ease: "none" },
        0
      );

      window.__timelines["scene-crawl"] = tl;
    </script>
  </div>
</template>
```

- [ ] **Step 2: Lint**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes lint
```

Expected: pass.

- [ ] **Step 3: Inspect for layout overflow at hero frames**

```bash
npx hyperframes inspect --at 1.5,5.2,10,13.5
```

Expected: no overflow warnings, or only intentional overflow on `#crawl-text` (the crawl literally exits the top of the frame). If the inspector flags `#crawl-text`, mark it with `data-layout-allow-overflow`:

```html
<div class="crawl-text" id="crawl-text" data-layout-allow-overflow>
```

Re-run inspect.

- [ ] **Step 4: Render and visually check**

```bash
npx hyperframes render --output ../film.mp4 --quality low
```

Open `../film.mp4`. Confirm:
- Prologue appears at ~0.5s, holds, fades by 4.5s.
- Yellow crawl rises from bottom around 5s and recedes correctly.
- Background stars don't drift dramatically.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/compositions/crawl.html
git commit -m "starwars-homage: scene 1 — opening crawl with prologue + 3D-tilt text"
```

---

## Task 5: Scene 2 — Binary Sunset (8s)

**Files:**
- Modify: `starwars-homage/composition/compositions/sunset.html`

- [ ] **Step 1: Write the sunset scene**

Replace the stub. Two suns sit low on the horizon over a dune line; a hooded silhouette stands right-of-center; sky gradient drifts redder; suns drift down 6px over 8s.

```html
<template id="scene-sunset-template">
  <div data-composition-id="scene-sunset" data-width="1920" data-height="1080">
    <style>
      [data-composition-id="scene-sunset"] {
        position: relative;
        width: 100%;
        height: 100%;
        background: #1a0a14;
        overflow: hidden;
      }
      [data-composition-id="scene-sunset"] .sky {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to bottom,
          #2a1530 0%,
          #5a2a3a 30%,
          #b04a3a 65%,
          #d96a32 82%,
          #b85020 95%,
          #4a1a14 100%
        );
        transition: filter 0.05s linear;
      }
      [data-composition-id="scene-sunset"] svg.scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      [data-composition-id="scene-sunset"] .haze {
        position: absolute;
        left: 0;
        right: 0;
        top: 75%;
        height: 14%;
        background: linear-gradient(
          to bottom,
          rgba(255, 220, 180, 0) 0%,
          rgba(255, 200, 160, 0.18) 50%,
          rgba(255, 220, 180, 0) 100%
        );
        filter: blur(2px);
        mix-blend-mode: screen;
      }
    </style>

    <div id="sunset-clip" class="clip" data-start="0" data-duration="8" data-track-index="0" style="position:absolute;inset:0;">
      <div class="sky" id="sunset-sky"></div>
      <div class="haze" id="sunset-haze"></div>

      <svg class="scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="sun-a" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFE6B0" stop-opacity="1" />
            <stop offset="40%" stop-color="#FFB347" stop-opacity="1" />
            <stop offset="80%" stop-color="#FFB347" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#FFB347" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="sun-b" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFF0C2" stop-opacity="1" />
            <stop offset="50%" stop-color="#FFD27A" stop-opacity="1" />
            <stop offset="100%" stop-color="#FFD27A" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- Suns: large warm + smaller cooler, low on horizon, slightly offset. -->
        <circle id="sun-large" cx="900" cy="780" r="160" fill="url(#sun-a)" />
        <circle id="sun-small" cx="1080" cy="820" r="80" fill="url(#sun-b)" />

        <!-- Dune horizon line + foreground dunes. -->
        <path
          d="M 0 880 Q 240 860 480 870 T 960 880 T 1440 884 T 1920 870 L 1920 1080 L 0 1080 Z"
          fill="#1a0c10"
        />
        <path
          d="M 0 940 Q 320 920 640 940 T 1280 942 T 1920 928 L 1920 1080 L 0 1080 Z"
          fill="#0a0508"
        />

        <!-- Hooded farm-hand silhouette right-of-center, looking at the suns. -->
        <g id="figure" transform="translate(1300 800)">
          <!-- Tunic body -->
          <path d="M -28 0 Q -38 50 -34 110 L 34 110 Q 38 50 28 0 Z" fill="#000" />
          <!-- Hood/head -->
          <path d="M -22 0 Q -26 -44 0 -50 Q 26 -44 22 0 Z" fill="#000" />
          <!-- Inner hood shadow -->
          <ellipse cx="0" cy="-30" rx="14" ry="18" fill="#0c0c0c" />
        </g>
      </svg>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // Both suns drift down 6px over 8s.
      tl.to("#sun-large", { attr: { cy: 786 }, duration: 8, ease: "none" }, 0);
      tl.to("#sun-small", { attr: { cy: 826 }, duration: 8, ease: "none" }, 0);

      // Sky tints one stop redder via a hue-rotate over 8s (subtle).
      tl.fromTo(
        "#sunset-sky",
        { filter: "hue-rotate(0deg) saturate(1)" },
        { filter: "hue-rotate(-8deg) saturate(1.08)", duration: 8, ease: "none" },
        0
      );

      // Heat-haze opacity pulses gently with a finite repeat (NOT -1).
      // Cycle = 1.6s; repeats inside 8s = ceil(8/1.6) - 1 = 4.
      tl.fromTo(
        "#sunset-haze",
        { opacity: 0.6 },
        { opacity: 1.0, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: 9 },
        0
      );

      // Subtle entrances so the rule "every element animates in" is satisfied.
      tl.from("#figure", { opacity: 0, y: 16, duration: 0.8, ease: "power2.out" }, 0.3);
      tl.from("#sun-large", { opacity: 0, duration: 0.6, ease: "power2.out" }, 0.0);
      tl.from("#sun-small", { opacity: 0, duration: 0.6, ease: "power2.out" }, 0.15);

      window.__timelines["scene-sunset"] = tl;
    </script>
  </div>
</template>
```

- [ ] **Step 2: Lint and inspect**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes lint
npx hyperframes inspect --at 0.5,4,7
```

Expected: pass; no overflow warnings on this static composition.

- [ ] **Step 3: Render and visually check**

```bash
npx hyperframes render --output ../film.mp4 --quality low
```

Confirm: two suns visible low in frame, hooded silhouette right-of-center, sky reads as deep apricot → violet, no haze flicker artifacts.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/compositions/sunset.html
git commit -m "starwars-homage: scene 2 — Tatooine binary sunset"
```

---

## Task 6: Scene 3 — X-Wing Launch (6s)

**Files:**
- Modify: `starwars-homage/composition/compositions/launch.html`

- [ ] **Step 1: Write the launch scene**

Replace the stub. Hangar parallax bands → four ships fly past on `MotionPath` arcs from deep frame, V formation, engines glowing cyan-white. The 4th ship crosses centre-frame at ~3.5s.

```html
<template id="scene-launch-template">
  <div data-composition-id="scene-launch" data-width="1920" data-height="1080">
    <style>
      [data-composition-id="scene-launch"] {
        position: relative;
        width: 100%;
        height: 100%;
        background: radial-gradient(ellipse at 50% 60%, #08121e 0%, #03070d 60%, #000 100%);
        overflow: hidden;
      }
      [data-composition-id="scene-launch"] svg.scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      [data-composition-id="scene-launch"] .ship {
        filter: drop-shadow(0 0 18px #9fe9ff) drop-shadow(0 0 38px rgba(159, 233, 255, 0.4));
      }
    </style>

    <div id="launch-clip" class="clip" data-start="0" data-duration="6" data-track-index="0" style="position:absolute;inset:0;">
      <svg class="scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
          <symbol id="xwing" viewBox="-60 -40 120 80">
            <!-- Fuselage -->
            <ellipse cx="0" cy="0" rx="34" ry="6" fill="#aab2bf" />
            <ellipse cx="20" cy="0" rx="16" ry="4" fill="#7d8694" />
            <!-- Wings (S-foils open) -->
            <polygon points="-10,-2 -50,-32 -56,-30 -16,2" fill="#aab2bf" />
            <polygon points="-10,2 -50,32 -56,30 -16,-2" fill="#7d8694" />
            <polygon points="14,-2 -26,-30 -32,-28 8,2" fill="#9aa2af" />
            <polygon points="14,2 -26,30 -32,28 8,-2" fill="#6e7785" />
            <!-- Engine glow tips -->
            <circle cx="-50" cy="-32" r="4" fill="#9fe9ff" />
            <circle cx="-50" cy="32" r="4" fill="#9fe9ff" />
            <circle cx="-26" cy="-30" r="4" fill="#9fe9ff" />
            <circle cx="-26" cy="30" r="4" fill="#9fe9ff" />
          </symbol>

          <!-- Motion paths: each ship arcs from upper-deep-frame past camera. -->
          <path id="path-1" d="M 200 200 Q 700 500 1200 950" />
          <path id="path-2" d="M 360 240 Q 800 540 1400 970" />
          <path id="path-3" d="M 280 320 Q 760 600 1320 1000" />
          <path id="path-4" d="M 460 300 Q 880 580 1480 990" />
        </defs>

        <!-- Hangar parallax bands (left + right ribbed walls). -->
        <g id="hangar-left">
          <rect x="0" y="0" width="180" height="1080" fill="#0a0a0a" />
          <g stroke="#1a1f28" stroke-width="2">
            <line x1="0" y1="120" x2="180" y2="100" />
            <line x1="0" y1="280" x2="180" y2="260" />
            <line x1="0" y1="440" x2="180" y2="420" />
            <line x1="0" y1="600" x2="180" y2="580" />
            <line x1="0" y1="760" x2="180" y2="740" />
            <line x1="0" y1="920" x2="180" y2="900" />
          </g>
        </g>
        <g id="hangar-right">
          <rect x="1740" y="0" width="180" height="1080" fill="#0a0a0a" />
          <g stroke="#1a1f28" stroke-width="2">
            <line x1="1740" y1="100" x2="1920" y2="120" />
            <line x1="1740" y1="260" x2="1920" y2="280" />
            <line x1="1740" y1="420" x2="1920" y2="440" />
            <line x1="1740" y1="580" x2="1920" y2="600" />
            <line x1="1740" y1="740" x2="1920" y2="760" />
            <line x1="1740" y1="900" x2="1920" y2="920" />
          </g>
        </g>

        <!-- Vignette mouth. -->
        <ellipse cx="960" cy="540" rx="900" ry="540" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="240" />

        <!-- Distant starfield through the mouth. -->
        <g id="far-stars" fill="#f5f5f5">
          <circle cx="700" cy="380" r="1.5" opacity="0.7" />
          <circle cx="900" cy="420" r="1" opacity="0.8" />
          <circle cx="1100" cy="360" r="1.5" opacity="0.6" />
          <circle cx="1300" cy="500" r="1" opacity="0.7" />
          <circle cx="800" cy="560" r="1.2" opacity="0.5" />
          <circle cx="1200" cy="600" r="1" opacity="0.6" />
        </g>

        <!-- Four ships, each tied to a motion path. -->
        <g class="ship" id="ship-1"><use href="#xwing" /></g>
        <g class="ship" id="ship-2"><use href="#xwing" /></g>
        <g class="ship" id="ship-3"><use href="#xwing" /></g>
        <g class="ship" id="ship-4"><use href="#xwing" /></g>
      </svg>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/MotionPathPlugin.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      gsap.registerPlugin(MotionPathPlugin);

      const tl = gsap.timeline({ paused: true });

      // Hangar bands fade in quickly, then ships streak past with stagger.
      tl.from("#hangar-left", { opacity: 0, x: -40, duration: 0.5, ease: "power2.out" }, 0.1);
      tl.from("#hangar-right", { opacity: 0, x: 40, duration: 0.5, ease: "power2.out" }, 0.1);
      tl.from("#far-stars", { opacity: 0, duration: 0.6, ease: "power2.out" }, 0.3);

      const SHIPS = [
        { id: "#ship-1", path: "#path-1", offset: 0.5, scale: 0.7 },
        { id: "#ship-2", path: "#path-2", offset: 0.8, scale: 0.85 },
        { id: "#ship-3", path: "#path-3", offset: 1.1, scale: 0.95 },
        { id: "#ship-4", path: "#path-4", offset: 1.4, scale: 1.1 }
      ];

      for (const s of SHIPS) {
        // Set initial scale and place offscreen-deep before the path runs.
        tl.set(s.id, { scale: 0.2, opacity: 0, transformOrigin: "50% 50%" }, s.offset - 0.001);
        tl.to(
          s.id,
          {
            opacity: 1,
            scale: s.scale,
            duration: 3.5,
            ease: "power2.in",
            motionPath: {
              path: s.path,
              align: s.path,
              autoRotate: false,
              alignOrigin: [0.5, 0.5]
            }
          },
          s.offset
        );
      }

      window.__timelines["scene-launch"] = tl;
    </script>
  </div>
</template>
```

- [ ] **Step 2: Lint**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes lint
```

Expected: pass.

- [ ] **Step 3: Inspect**

```bash
npx hyperframes inspect --at 0.5,2,3.5,5
```

Expected: pass; if ships are flagged offscreen at t=0 (they're hidden via `opacity: 0` until their `offset`), mark them with `data-layout-allow-overflow`. Re-run.

- [ ] **Step 4: Render and visually check**

```bash
npx hyperframes render --output ../film.mp4 --quality low
```

Confirm: ships emerge from deep frame, scale up, and exit lower-right with cyan engine glow.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/compositions/launch.html
git commit -m "starwars-homage: scene 3 — X-wing launch with MotionPath formation"
```

---

## Task 7: Scene 4 — Trench Run (8s)

**Files:**
- Modify: `starwars-homage/composition/compositions/trench.html`

The trench is the highest-risk scene because the WebGL fragment shader must read its scroll state from a GSAP-tweened uniform (not from `gl-time` or `Date.now`), so the deterministic capture engine produces the same frames every render. The pattern: a `proxy` object whose `scroll` property is tweened by GSAP; on every `onUpdate` we set a uniform on the GL program and re-draw.

- [ ] **Step 1: Write the trench scene**

Replace the stub. Layer A is a full-frame `<canvas>` running a procedural trench shader. Layer B is an SVG overlay with the cockpit canopy, HUD reticle, TIE pursuer, laser bolts, speed lines, and the final flash.

```html
<template id="scene-trench-template">
  <div data-composition-id="scene-trench" data-width="1920" data-height="1080">
    <style>
      [data-composition-id="scene-trench"] {
        position: relative;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: hidden;
      }
      [data-composition-id="scene-trench"] canvas#trench-gl,
      [data-composition-id="scene-trench"] svg.cockpit {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      [data-composition-id="scene-trench"] .flash {
        position: absolute;
        inset: 0;
        background: #fff;
        opacity: 0;
        pointer-events: none;
      }
    </style>

    <div id="trench-clip" class="clip" data-start="0" data-duration="8" data-track-index="0" style="position:absolute;inset:0;">
      <canvas id="trench-gl" width="1920" height="1080"></canvas>

      <svg class="cockpit" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <!-- Cockpit canopy frame (dark overlay around the edges, with a window cut). -->
        <defs>
          <mask id="canopy-window">
            <rect width="1920" height="1080" fill="#fff" />
            <ellipse cx="960" cy="540" rx="700" ry="380" fill="#000" />
          </mask>
        </defs>
        <rect width="1920" height="1080" fill="#0a0a0a" mask="url(#canopy-window)" />

        <!-- HUD reticle. -->
        <g id="hud" transform="translate(960 540)" stroke="#ffe81f" stroke-width="2.5" fill="none">
          <circle r="80" opacity="0.85" />
          <circle r="14" opacity="0.85" />
          <line x1="-110" y1="0" x2="-90" y2="0" />
          <line x1="110" y1="0" x2="90" y2="0" />
          <line x1="0" y1="-110" x2="0" y2="-90" />
          <line x1="0" y1="110" x2="0" y2="90" />
          <text id="hud-lock" x="100" y="-100" font-family="JetBrains Mono, monospace" font-size="22" fill="#ffe81f" stroke="none" opacity="0">
            LOCK
          </text>
        </g>

        <!-- Speed lines (left + right). -->
        <g id="speed-lines" stroke="#ffffff" stroke-width="2" opacity="0.55">
          <line x1="100" y1="540" x2="40" y2="540" />
          <line x1="180" y1="430" x2="100" y2="430" />
          <line x1="160" y1="650" x2="80" y2="650" />
          <line x1="1820" y1="540" x2="1880" y2="540" />
          <line x1="1740" y1="430" x2="1820" y2="430" />
          <line x1="1760" y1="650" x2="1840" y2="650" />
        </g>

        <!-- TIE pursuer (rear silhouette). -->
        <g id="tie" transform="translate(960 240) scale(0.6)">
          <circle cx="0" cy="0" r="18" fill="#1a1f28" stroke="#3a4252" stroke-width="2" />
          <line x1="-20" y1="0" x2="-50" y2="0" stroke="#3a4252" stroke-width="3" />
          <line x1="20" y1="0" x2="50" y2="0" stroke="#3a4252" stroke-width="3" />
          <polygon points="-50,-30 -50,30 -62,30 -62,-30" fill="#1a1f28" stroke="#3a4252" stroke-width="2" />
          <polygon points="50,-30 50,30 62,30 62,-30" fill="#1a1f28" stroke="#3a4252" stroke-width="2" />
        </g>

        <!-- Laser bolts (red). Animated visibility via tl.set + tl.to. -->
        <g id="laser-1" stroke="#ff3030" stroke-width="6" stroke-linecap="round" opacity="0">
          <line x1="900" y1="240" x2="700" y2="540" />
        </g>
        <g id="laser-2" stroke="#ff3030" stroke-width="6" stroke-linecap="round" opacity="0">
          <line x1="1020" y1="240" x2="1240" y2="540" />
        </g>
      </svg>

      <div id="trench-flash" class="flash"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};

      // ---- WebGL trench shader, driven by a GSAP-tweened scroll uniform. ----
      const canvas = document.getElementById("trench-gl");
      const gl = canvas.getContext("webgl");
      let glProgram = null,
        uScroll = null,
        uRes = null,
        glRender = () => {};

      if (gl) {
        const vsrc = `
          attribute vec2 a_pos;
          varying vec2 v_uv;
          void main() {
            v_uv = a_pos * 0.5 + 0.5;
            gl_Position = vec4(a_pos, 0.0, 1.0);
          }
        `;
        const fsrc = `
          precision highp float;
          varying vec2 v_uv;
          uniform float u_scroll;
          uniform vec2 u_res;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float greeble(vec2 p) {
            // Box-fold style greebles: nested grids of brightness steps.
            vec2 g0 = floor(p);
            vec2 g1 = floor(p * 2.0);
            vec2 g2 = floor(p * 4.0);
            float v = 0.0;
            v += hash(g0) * 0.55;
            v += hash(g1 + 17.0) * 0.30;
            v += hash(g2 + 41.0) * 0.15;
            return v;
          }

          void main() {
            // Map screen UV to a trench cross-section: floor + two walls in perspective.
            vec2 uv = v_uv;
            uv.x = uv.x * 2.0 - 1.0; // -1..1 across width
            float depth = 1.0 / max(0.001, 1.0 - uv.y); // pseudo-perspective along screen y

            // Forward scroll in world units along the trench length.
            float worldZ = u_scroll + depth * 12.0;

            // Wall mapping: |uv.x| > 0.5 → wall, otherwise floor.
            float ax = abs(uv.x);
            float wall = step(0.5, ax);
            vec2 wallUV = vec2(worldZ, (uv.y - 0.4) * 6.0 + ax * 2.0);
            vec2 floorUV = vec2(worldZ, uv.x * 4.0);

            float g = mix(greeble(floorUV * 1.6), greeble(wallUV * 1.4), wall);

            // Lighting: floor darker, walls catch a thin rim toward the centre.
            float light = mix(0.5, 0.75, wall);
            light *= mix(1.0, 0.7, smoothstep(0.0, 0.85, ax));

            // Distance fog toward the depth horizon.
            float fog = clamp(1.0 - depth * 0.07, 0.0, 1.0);

            float gray = g * light * fog;
            // Tint cool grey-blue.
            vec3 col = vec3(gray * 0.92, gray * 0.95, gray * 1.05);

            // Centre vanishing-point glow toward the exhaust port.
            vec2 c = v_uv - vec2(0.5, 0.62);
            c.x *= u_res.x / u_res.y;
            float port = exp(-dot(c, c) * 240.0);
            col += vec3(0.95, 0.85, 0.4) * port * 0.5;

            gl_FragColor = vec4(col, 1.0);
          }
        `;

        function compile(type, src) {
          const sh = gl.createShader(type);
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error("shader compile error", gl.getShaderInfoLog(sh));
          }
          return sh;
        }
        const vs = compile(gl.VERTEX_SHADER, vsrc);
        const fs = compile(gl.FRAGMENT_SHADER, fsrc);
        glProgram = gl.createProgram();
        gl.attachShader(glProgram, vs);
        gl.attachShader(glProgram, fs);
        gl.linkProgram(glProgram);
        gl.useProgram(glProgram);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW
        );
        const aPos = gl.getAttribLocation(glProgram, "a_pos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        uScroll = gl.getUniformLocation(glProgram, "u_scroll");
        uRes = gl.getUniformLocation(glProgram, "u_res");
        gl.uniform2f(uRes, canvas.width, canvas.height);

        glRender = (scroll) => {
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform1f(uScroll, scroll);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        };
        glRender(0);
      } else {
        // Fallback: paint a static gradient so the scene isn't blank without WebGL.
        const ctx2 = canvas.getContext("2d");
        const grad = ctx2.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, "#0a0a0a");
        grad.addColorStop(1, "#202028");
        ctx2.fillStyle = grad;
        ctx2.fillRect(0, 0, canvas.width, canvas.height);
      }

      const tl = gsap.timeline({ paused: true });

      // Drive the trench shader: scroll uniform tweens 0 → 80 over 8s, ease "none".
      const proxy = { scroll: 0 };
      tl.to(
        proxy,
        {
          scroll: 80,
          duration: 8,
          ease: "none",
          onUpdate: () => glRender(proxy.scroll)
        },
        0
      );

      // HUD reticle: subtle entrance, slow pulse, lock label appears at 6.5s.
      tl.from("#hud", { opacity: 0, scale: 0.85, duration: 0.6, ease: "power2.out", transformOrigin: "50% 50%" }, 0.2);
      tl.fromTo(
        "#hud circle:first-of-type",
        { strokeOpacity: 0.55 },
        { strokeOpacity: 1.0, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: 9 },
        0
      );
      tl.fromTo("#hud-lock", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }, 6.5);

      // TIE pursuer: bobs slightly, finite repeat (cycle 1.4s, 8s/1.4 = 5.7 → repeat 5).
      tl.from("#tie", { opacity: 0, y: -20, duration: 0.6, ease: "power2.out" }, 0.4);
      tl.fromTo("#tie", { y: 0 }, { y: 12, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: 9 }, 0);

      // Two laser bolts at 2.5s and 4.0s (briefly visible).
      tl.set("#laser-1", { opacity: 0 }, 0);
      tl.to("#laser-1", { opacity: 1, duration: 0.05 }, 2.5);
      tl.to("#laser-1", { opacity: 0, duration: 0.15 }, 2.6);
      tl.set("#laser-2", { opacity: 0 }, 0);
      tl.to("#laser-2", { opacity: 1, duration: 0.05 }, 4.0);
      tl.to("#laser-2", { opacity: 0, duration: 0.15 }, 4.1);

      // Camera shake: subtle wrapper jitter on speed-lines + cockpit overlay.
      tl.fromTo(
        "#speed-lines",
        { x: 0 },
        { x: 6, duration: 0.18, ease: "sine.inOut", yoyo: true, repeat: 39 },
        0
      );

      // Final beat: white flash from 7.7s → 7.95s into the cut.
      tl.fromTo("#trench-flash", { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "power2.in" }, 7.7);
      tl.to("#trench-flash", { opacity: 0, duration: 0.05, ease: "none" }, 7.95);

      window.__timelines["scene-trench"] = tl;
    </script>
  </div>
</template>
```

- [ ] **Step 2: Lint**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes lint
```

Expected: pass. If lint complains about `repeat: 9`/`repeat: 39` (it should not — those are finite), re-check it isn't `-1` anywhere.

- [ ] **Step 3: Render and visually check**

```bash
npx hyperframes render --output ../film.mp4 --quality low
```

Confirm:
- The trench surface scrolls (not freezes) — proves the GSAP-driven `u_scroll` uniform is reaching the shader.
- HUD reticle, TIE silhouette, and lasers all show up at the right beats.
- Final white flash hits at 7.7-7.95s, hard cut into title.

If the canvas is blank in the rendered MP4:
- Check the DevTools console in `npx hyperframes preview` for shader compile errors.
- Confirm WebGL is available in the headless renderer (`npx hyperframes doctor` reports a working browser).

- [ ] **Step 4: Inspect**

```bash
npx hyperframes inspect --at 1,4,7.5
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/compositions/trench.html
git commit -m "starwars-homage: scene 4 — trench run shader + cockpit overlay"
```

---

## Task 8: Title card (2s)

**Files:**
- Modify: `starwars-homage/composition/compositions/title.html`

- [ ] **Step 1: Write the title card**

Replace the stub. Black background, 60-star parallax field, big serif "A New Hope" with italic Hope, small JetBrains Mono credit beneath. Final scene → exit animations are *allowed* here per HyperFrames discipline.

```html
<template id="scene-title-template">
  <div data-composition-id="scene-title" data-width="1920" data-height="1080">
    <style>
      [data-composition-id="scene-title"] {
        position: relative;
        width: 100%;
        height: 100%;
        background: #000;
        color: #fff;
        font-family: "Fraunces", "Times New Roman", serif;
        overflow: hidden;
      }
      [data-composition-id="scene-title"] svg.title-stars {
        position: absolute;
        inset: 0;
      }
      [data-composition-id="scene-title"] .title-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }
      [data-composition-id="scene-title"] .title-text h2 {
        font-family: "Fraunces", "Times New Roman", serif;
        font-weight: 600;
        font-size: 152px;
        margin: 0;
        line-height: 1;
        letter-spacing: -0.01em;
      }
      [data-composition-id="scene-title"] .title-text h2 em {
        color: #b04a2f;
        font-style: italic;
      }
      [data-composition-id="scene-title"] .title-text p {
        margin: 24px 0 0;
        font-family: "JetBrains Mono", "Courier New", monospace;
        font-size: 18px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #b8b8b8;
      }
    </style>

    <div id="title-clip" class="clip" data-start="0" data-duration="2" data-track-index="0" style="position:absolute;inset:0;">
      <svg class="title-stars" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"></svg>

      <div class="title-text">
        <h2 id="title-h">A New <em>Hope</em></h2>
        <p id="title-credit">an homage · vibe-demos</p>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};

      function mulberry32(a) {
        return function () {
          var t = (a += 0x6d2b79f5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      const rand = mulberry32(0xc0de);

      const svg = document.querySelector('[data-composition-id="scene-title"] .title-stars');
      const NS = "http://www.w3.org/2000/svg";
      for (let i = 0; i < 60; i++) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(rand() * 1920));
        c.setAttribute("cy", String(rand() * 1080));
        c.setAttribute("r", String(0.6 + rand() * 1.4));
        c.setAttribute("fill", "#f5f5f5");
        c.setAttribute("opacity", String(0.4 + rand() * 0.6));
        svg.appendChild(c);
      }

      const tl = gsap.timeline({ paused: true });
      tl.from("#title-h", { y: 30, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.1);
      tl.from("#title-credit", { y: 16, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.5);
      // Final scene only: allowed exit fade.
      tl.to("#title-clip", { opacity: 0, duration: 0.4, ease: "power2.in" }, 1.6);

      window.__timelines["scene-title"] = tl;
    </script>
  </div>
</template>
```

- [ ] **Step 2: Lint**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes lint
```

Expected: pass.

- [ ] **Step 3: Render and visually check**

```bash
npx hyperframes render --output ../film.mp4 --quality low
```

Confirm: title fades in centered, credit fades in slightly later, the whole card fades out.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/composition/compositions/title.html
git commit -m "starwars-homage: scene 5 — title card"
```

---

## Task 9: Source the public-domain audio cue

**Files:**
- Create: `starwars-homage/audio.mp3`

- [ ] **Step 1: Pick a public-domain orchestral cue**

Suggested sources (all CC0 or PD): Musopen.org (search "fanfare"), the Internet Archive's PD orchestral music, or a Kevin MacLeod fanfare under CC-BY (note: CC-BY needs attribution in the demo — if you take a Kevin MacLeod track, add "music: Kevin MacLeod, CC-BY" to the page's `.meta` line).

Aim for ~38s of orchestral fanfare or hopeful brass. If you can't find a single 38s cue, splice two PD pieces together or trim a longer one.

- [ ] **Step 2: Trim to 38s and convert to MP3**

If the source is WAV/FLAC, use `ffmpeg`:

```bash
ffmpeg -i source.wav -t 38 -b:a 192k /home/ubuntu/projects/vibe-demos/starwars-homage/audio.mp3
ls -lh /home/ubuntu/projects/vibe-demos/starwars-homage/audio.mp3
```

Expected: ~900 KB MP3.

- [ ] **Step 3: Decide whether to include it in the rendered video**

Two options:

(A) Mute the rendered MP4; the demo shell page plays `audio.mp3` separately, synced to `video.play()`. This keeps the video file smaller and lets users mute it independently.

(B) Mux the audio into `film.mp4` at render time so it's a self-contained cinematic.

Default to **(A)** for now — it's simpler and matches the audio-as-overlay vibe. To wire it up, modify `starwars-homage/index.html`'s `play()` function:

```js
function play() {
  body.dataset.state = "playing";
  video.dataset.show = "true";
  video.currentTime = 0;
  video.play().catch(() => {
    body.dataset.state = "idle";
    video.dataset.show = "false";
  });
  audio.currentTime = 0;
  audio.volume = 0.7;
  audio.play().catch(() => {});
}
video.addEventListener("ended", () => {
  body.dataset.state = "ended";
  audio.pause();
});
```

And add the audio element to the `<div class="player">`:

```html
<audio id="audio" src="audio.mp3" preload="metadata"></audio>
```

And reference it from JS:

```js
const audio = document.getElementById("audio");
```

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add starwars-homage/audio.mp3 starwars-homage/index.html
git commit -m "starwars-homage: PD orchestral cue + shell audio sync"
```

---

## Task 10: Final render, poster, validation

**Files:**
- Create/overwrite: `starwars-homage/film.mp4`
- Create: `starwars-homage/poster.jpg`

- [ ] **Step 1: Final render at medium quality**

```bash
cd /home/ubuntu/projects/vibe-demos/starwars-homage/composition
npx hyperframes render --output ../film.mp4 --quality medium
ls -lh ../film.mp4
```

Expected: 5-15 MB MP4. If above 15 MB:

```bash
npx hyperframes render --output ../film.mp4 --quality low
```

- [ ] **Step 2: Capture the poster frame at 36s (title card opening)**

```bash
npx hyperframes snapshot --at 36 --out ../poster.jpg
ls -lh ../poster.jpg
```

Expected: a JPG showing the title card (200-400 KB).

If `snapshot` doesn't exist or doesn't accept `--at`, fall back to `ffmpeg`:

```bash
ffmpeg -ss 36 -i ../film.mp4 -frames:v 1 -q:v 4 ../poster.jpg
```

- [ ] **Step 3: Run all HyperFrames quality checks**

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect
```

Expected: all pass. Fix any reported issues.

- [ ] **Step 4: Verify the demo page plays the final film locally**

```bash
cd /home/ubuntu/projects/vibe-demos
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1
echo "Open http://127.0.0.1:8765/starwars-homage/ in a browser, click Play, watch all 38 seconds."
```

After verifying visually in a browser:

```bash
kill $SERVER_PID
```

Verify:
- Idle state shows poster + Play button.
- Click Play: body goes black, video fills viewport, audio starts.
- Crawl renders correctly (yellow tilted text, prologue card visible at the start).
- All four scenes play with crossfades.
- Ended state shows Replay button + credit.

- [ ] **Step 5: Commit**

```bash
git add starwars-homage/film.mp4 starwars-homage/poster.jpg
git commit -m "starwars-homage: final 38s render + poster"
```

---

## Task 11: Wire the demo into the works index, README, IDEAS

**Files:**
- Modify: `index.html` (root)
- Modify: `README.md`
- Modify: `IDEAS.md`

- [ ] **Step 1: Read the current works index to find the next number and the labels map**

```bash
grep -n "data-status=\"soon\"\|class=\"work\"\|labels\|count\|<div class=\"count\">\|Index /" /home/ubuntu/projects/vibe-demos/index.html | head -40
```

Note: the count format is `Index / NN entries` and the next chronological number is one higher than the highest currently-shipped row. There are 8 shipped demos as of writing (sweden-food-guide, molecule-journey, live-globe, intake-companion, korean-mbti, resonans, tinywings, plus possibly clinic-admin). Verify by reading the index. The new row gets the next two-digit number.

- [ ] **Step 2: Add a works-index row**

Open `index.html` (root) and locate the `<section class="works">`. Add the new row in chronological position (after the highest-numbered shipped row, replacing a `data-status="soon"` placeholder if one sits at the new row's number).

```html
<a class="work" href="starwars-homage/" data-preview="starwars">
  <span class="num">NN</span>
  <span class="title">A New <em>Hope</em></span>
  <span class="tags">CINEMATIC HOMAGE<br>HYPERFRAMES MP4<br>FOUR-BEAT FILM</span>
  <span class="year">2026</span>
  <span class="arrow">→</span>
</a>
```

Replace `NN` with the actual two-digit number.

- [ ] **Step 3: Increment the count**

In the same file, find:

```html
<div class="count">Index / NN entries</div>
```

and increment NN by one (only counting shipped, non-`data-status="soon"` rows).

- [ ] **Step 4: Add the labels map entry**

Find the inline `<script>` containing the `labels` object and add:

```js
const labels = { sweden: "Svensk Mat", /* …existing entries… */, starwars: "A New Hope" };
```

The key (`starwars`) must match the `data-preview` attribute on the row.

- [ ] **Step 5: Update README.md "Live demos" section**

Find the `## Live demos` section and add a bullet (chronologically, mirroring the works index):

```markdown
- [`starwars-homage/`](./starwars-homage/) — *A New Hope*. A 38-second cinematic homage in four beats — opening crawl, binary sunset, X-wing launch, trench run. Authored with HyperFrames, rendered to MP4.
```

- [ ] **Step 6: Update IDEAS.md**

Append a new entry under "Wildcards / nice-to-have":

```markdown
### W8 · A New Hope — Cinematic Homage 🟢 shipped → [/starwars-homage/](./starwars-homage/)

Star Wars: Episode IV homage as a 38-second four-beat mini-movie (crawl → Tatooine binary sunset → X-wing launch → trench run → title card). Authored with **HyperFrames**, rendered to MP4, embedded in a thin PWA shell. First vibe-demo where the artifact is a rendered video rather than a live page.

- **Tech:** HyperFrames + GSAP (incl. MotionPath) + raw WebGL fragment shader for the trench. No Three.js — stays inside HyperFrames idioms.
- **IP framing:** Star Jedi font (free fan-clone), original ship silhouettes, public-domain orchestral cue (no John Williams in the public repo). Names from canon used in our own prose.
- **Slug:** `starwars-homage` · **Scope:** medium-large (2 sessions). Trench shader is the long pole.
```

- [ ] **Step 7: Verify the served pages still load**

```bash
cd /home/ubuntu/projects/vibe-demos
python3 -m http.server 8765 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1
curl -sf "http://127.0.0.1:8765/" -o /dev/null && echo "✓ landing loads"
curl -sf "http://127.0.0.1:8765/starwars-homage/" -o /dev/null && echo "✓ demo loads"
kill $SERVER_PID
```

Open the landing in a browser and confirm:
- The new row appears at the right number.
- The cursor preview shows "A New Hope" when hovering it.
- Clicking it navigates to the demo.

- [ ] **Step 8: Commit**

```bash
git add index.html README.md IDEAS.md
git commit -m "studio: index A New Hope at slot NN"
```

---

## Task 12: Push, verify deployment, smoke-test live URL

- [ ] **Step 1: Push to main**

```bash
cd /home/ubuntu/projects/vibe-demos
git push origin main
```

- [ ] **Step 2: Wait for Pages to deploy and verify**

```bash
sleep 60
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/starwars-homage/
```

Expected: `200`. If `404`, wait another 30 seconds and retry.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/starwars-homage/film.mp4
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/starwars-homage/poster.jpg
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/starwars-homage/audio.mp3
```

Expected: three `200`s.

- [ ] **Step 3: Verify the works-index update propagated**

```bash
curl -s https://kalleeh.github.io/vibe-demos/ | grep -c "starwars-homage"
```

Expected: at least `1` (the row href) — likely `2-3` (href + label).

- [ ] **Step 4: Open the live page in a browser**

Navigate to https://kalleeh.github.io/vibe-demos/starwars-homage/ . Click Play. Confirm the full 38 seconds plays cleanly on desktop and on a phone. Watch for:
- MP4 downloads quickly (under ~5s on a normal connection).
- Audio plays in sync, fades cleanly with the video.
- Reduced-motion test: in DevTools / OS settings, enable "reduce motion", reload, confirm autoplay is suppressed (already is — playback only on click) and the (reduced motion) hint shows on the play button.

- [ ] **Step 5: Done — no commit needed**

The plan is complete once the live URL works.

---

## Self-review

After writing this plan, I checked:

**Spec coverage:**
- Concept (§1) → Tasks 1, 11 (shell + indexing).
- IP framing (§2) → Tasks 2 (font + license), 9 (PD audio).
- Scene rhythm (§3) → Task 3 (root timeline + crossfades).
- Each scene (§4.1-4.5) → Tasks 4, 5, 6, 7, 8.
- Architecture & files (§5) → Tasks 0, 1, 3.
- Workflow (§6) → woven through all tasks; final pass in Task 10.
- Risks (§7) → Task 7 spike-shaped (shader is the standalone task; if it fails we can ship 4 scenes only).
- Out of scope (§8) → not in any task (correct).
- Success criteria (§9) → Task 12 is the verification step.

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or vague "add error handling". Task 11 contains `NN` for the works-index slot number — that's intentional (the executor reads the live index and fills it in) and bracketed with explicit instructions on how to determine it.

**Type/name consistency:** Composition IDs (`scene-crawl`, `scene-sunset`, `scene-launch`, `scene-trench`, `scene-title`) match across the root composition, sub-composition templates, and timeline registrations. The `mulberry32` PRNG signature is identical in crawl and title compositions. The crossfade `#fader` element is referenced consistently. The shader uniform `u_scroll` is set in JS and read in GLSL with the same name.
