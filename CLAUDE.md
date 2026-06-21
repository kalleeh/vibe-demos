# vibe-demos — instructions for Claude

This repo is a public collection of small interactive demos built live with the user. Each demo is its own subfolder of plain static HTML/CSS/JS. The root is an editorial-style "studio portfolio" landing that links to every demo.

**Live URL:** https://kalleeh.github.io/vibe-demos/ — each demo lives at `https://kalleeh.github.io/vibe-demos/<slug>/`. GitHub Pages serves `main` from the repo root. Push to `main` = deploy. There is no build step.

## Repository layout

```
vibe-demos/
├── CLAUDE.md           ← this file (lean core; loaded every session)
├── .claude/rules/      ← path-scoped playbooks (load only when editing matching files)
├── README.md           ← human-facing list of demos (mirror of works index)
├── index.html          ← editorial "studio" landing page; contains the works index
└── <slug>/             ← one folder per demo, kebab-case slug
    ├── index.html      ← demo entry point, served by Pages
    └── ...             ← any other assets the demo needs
```

## Domain playbooks (`.claude/rules/`)

Detailed guidance lives in path-scoped rule files that auto-load when you edit a matching file. Read the relevant one before working in that area:

- **`ai-demos.md`** — demos that call Claude (endpoint/auth, key handling, canned-vs-live, streaming, and the domain-tuned system-prompt methodology). Reference: `intake-companion/`.
- **`threejs.md`** — 3D rendering fidelity stack, Kenney CC0 assets, `paintKenney`. Reference: `molecule-journey/`.
- **`pwa.md`** — installable PWA shell (manifest, icon, per-demo + root service workers, cache invalidation). Reference: `intake-companion/sw.js`, root `sw.js`.
- **`pocketbase.md`** — optional persistence/sync backend (decision tree, migrations, security tiers, local-first fallback, `sync-backends.sh`). Reference: `tinywings/`. **Always check Context7 before backend work.**
- **`loading-ux.md`** — visible-motion loading states for any async work.

## Currently shipped demos

Verify with `ls` before recommending — this list can drift.

- `sweden-food-guide/` — Korean-language interactive travel + food guide for Sweden. Self-contained.
- `molecule-journey/` — Three.js scrollytelling, six chapters following one methane molecule from LNG tanker to Seoul kitchen flame. Kenney CC0 GLBs in `assets/`.
- `live-globe/` — interactive 3D Earth (Three.js), live time/weather/sunrise/sunset for Seoul ⇄ Stockholm, AI "right now" snapshots.
- `intake-companion/` — Korean traditional medicine (한방) intake assistant. Voice-in, structured 변증/처방/경혈 brief, three-way model toggle. **Reference implementation for the AI demo pattern.**
- `korean-mbti/` — short Korean MBTI test + AI deep-read mode inferring type from a free-form passage.
- `resonans/` — calm sketchbook game on a hand-drawn cream-paper string. Real 1D wave physics; no score, no timer.
- `clinic-admin/` — Korean 한방병원 administration assistant. Camera/OCR + voice + share-sheet intake, ⌘K command palette, guided tour.
- `tinywings/` ("Sketchwings") — one-tap arcade glider over pencil hills with a day/night cycle. **Canonical PocketBase demo** (shared leaderboard, local-first fallback). Reuses `assets/hero-mood.webp` as its works-index thumbnail (path is in root `sw.js` allow-list).
- `starwars-homage/` ("A New Hope") — 38s cinematic homage rendered to MP4 via the HyperFrames CLI. Ships `film.mp4` + `poster.jpg`; research in `composition/refs/`. (Renders to MP4 — no Three.js at runtime.)
- `changwon-homes/` ("Changwon Home Finder") — Korean-language Leaflet map of ~829 real Changwon apartment complexes from 국토교통부 실거래가, each marker scored (green=good deal → red=overpriced) and sized by 평형, with per-평형 price-vs-local-peers detail. Data is baked to a static `data.json` (build scripts in `scripts/`); the page is client-only, no API key, works offline. (Has a `pb/` upload chute for the data-build pipeline only — not part of the live demo.)
- `kids-bookshelf/` ("책친구 — Kids Book Friend") — Korean crayon-picture-book recommender for ages 0–9. Deterministic offline scoring over an append-only ~350-title catalog (`catalog.js`, see `CATALOG.md`); optional **AI 맞춤 추천** mode (Claude Sonnet via the shared Bedrock proxy) only polishes wording of the already-chosen books. Client-only, no backend.
- `contraption-lab/` ("Contraption Lab") — a modern *Incredible Machine*: drag parts to build Rube Goldberg contraptions, then Run the physics (Matter.js, vendored, no build step). 20 verified-solvable levels, ~32 parts, community level editor + optional PocketBase accounts/leaderboards. Specs and the maintenance contract for it live in `contraption-lab/*-design.md`; run `tools/solve-verify.mjs` after ANY level/parts change.

## Future ideas

A backlog of demo pitches lives in [IDEAS.md](./IDEAS.md). When the user asks "what should we build next", read that file. Mark a pitch `🟢 shipped` when it ships.

## The maintenance contract — READ THIS BEFORE EDITING

Whenever you **add**, **remove**, or **rename** a demo, update three things in the same commit. They mirror each other; if they drift, the studio looks broken.

### 1. The demo's own folder
- Slug is **kebab-case** (`sweden-food-guide`).
- Entry point is `<slug>/index.html` so Pages serves it without a trailing filename.
- Any CSS/JS/assets live next to that file. Demos are self-contained — do not share CSS/JS across demos unless asked.

### 2. The root `index.html` works index
The works index is `<section class="works" id="works">` in `index.html` — the visible portfolio. Every shipped demo gets one `<a class="work" ...>` row.

When **adding** a demo:
- Pick the next two-digit number (`01`, `02`, …). Numbering is **chronological by ship order, never reused** — if `02` is later removed, `02` stays retired; do not renumber.
- If a `data-status="soon"` placeholder sits at the right number, replace it rather than appending after it.
- Update the `<div class="count">` text (`Index / NN entries`) to the number of **shipped** entries (exclude `soon` rows).
- Add a thumbnail: a 1280×720 JPG at `thumbs/<slug>.jpg` (PNG/WebP if the source needs it — match what's there), referenced inline via `<span class="thumb"><img src="./thumbs/<slug>.jpg" ...>`. A demo may instead reuse one of its own hero assets (e.g. tinywings); if so, add that path to the root `sw.js` cross-demo allow-list so the landing's SW can cache it.
- If fewer than 3 visible rows total, top up with `data-status="soon"` placeholders. If 3+ shipped, drop the placeholders.
- Match the existing visual grammar: `<span class="num">`, `<span class="title">` with one word italicised in `<em>`, `<span class="tags">` (3 short uppercase phrases separated by `<br>`), `<span class="thumb">`, `<span class="year">`, `<span class="arrow">→</span>`.

When **removing** a demo: delete the folder; remove its works-index row; decrement the count; delete `thumbs/<slug>.jpg` (and remove the path from root `sw.js`); if the slot was mid-sequence, insert a `data-status="soon"` placeholder at that number (do NOT renumber later entries).

When **renaming** a demo: move the folder to the new slug; update the row `href`; rename the thumbnail + update its `<img src>` and the path in root `sw.js`; update the `README.md` link.

> Legacy note: an earlier landing used a cursor-follow `data-preview` + `labels` map. That's gone — rows now use only the inline `<span class="thumb">`. Do not reintroduce `data-preview` or a `labels` map.

### 3. `README.md`
The `## Live demos` section mirrors the works index in plain markdown — one bullet per shipped demo (path, title, one-line description). Keep it in sync with any works-index change.

## Editorial / styling rules for the landing

The landing is intentionally editorial — cream paper, grain overlay, Fraunces serif display, Inter body, JetBrains Mono for metadata. Don't drift without being asked.

- New works-index rows reuse the existing classes — do not invent new ones.
- The italicised word in each `<span class="title">` is the focal word; pick one that reads well as a serif italic (usually a noun).
- Tags are 3 short uppercase phrases — keep them concise (overlong tags break the right-hand column).
- The accent (rust orange `#b04a2f`) is reserved for hover, italic emphasis, and the live indicator — not incidental UI.
- Top marquee phrases can be edited freely; keep them short and italic-friendly.

## Deployment & verification

Pages serves whatever is on `main`. After pushing:
1. Wait ~30–60s for the build.
2. `curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/<slug>/` → expect `200`.
3. Optionally `curl -s https://kalleeh.github.io/vibe-demos/ | grep -c "<expected text>"` (Pages caches; the first few requests may return the previous build).

Do not enable workflows, custom domains, or branch-protection without the user asking. Pages settings live at `gh api repos/kalleeh/vibe-demos/pages` — only touch on explicit request.

## Things to NOT do

- Do not introduce a build tool, framework, or package.json. Demos are plain static files. (`sync-backends.sh` is a backend deploy script, not a frontend build step.)
- Do not share CSS between the landing and individual demos — each has its own visual identity.
- Do not commit secrets, analytics scripts, or trackers.
- Do not force-push `main` unless the user asks.
- Do not edit `index.html` styling without preserving the editorial grammar above.
