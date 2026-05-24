# vibe-demos — instructions for Claude

This repo is a public collection of small interactive demos built live with the user. Each demo is its own subfolder of plain static HTML/CSS/JS. The root is an editorial-style "studio portfolio" landing that links to every demo.

**Live URL:** https://kalleeh.github.io/vibe-demos/
Each demo lives at `https://kalleeh.github.io/vibe-demos/<slug>/`.

## Repository layout

```
vibe-demos/
├── CLAUDE.md           ← this file
├── README.md           ← human-facing list of demos (mirror of works index)
├── index.html          ← editorial "studio" landing page; contains the works index
└── <slug>/             ← one folder per demo, kebab-case slug
    ├── index.html      ← demo entry point, served by Pages
    └── ...             ← any other assets the demo needs
```

Currently shipped demos (verify with `ls` before recommending — this list can drift):

- `sweden-food-guide/` — Korean-language interactive guide to Swedish restaurants & food. Self-contained `index.html` + `shared.css`.

GitHub Pages is configured to serve `main` from the repo root. Push to `main` = deploy. There is no build step.

## The maintenance contract — READ THIS BEFORE EDITING

Whenever you **add**, **remove**, or **rename** a demo, you MUST update three things in the same commit. They are designed to mirror each other; if they drift, the studio looks broken.

### 1. The demo's own folder

- Slug is **kebab-case** (`sweden-food-guide`, not `swedenFoodGuide` or `sweden_food_guide`).
- Every demo's entry point is `<slug>/index.html` so Pages serves it without a trailing filename.
- Any CSS/JS/assets the demo needs live next to that file. Demos are self-contained — do not share CSS or JS across demos unless asked.

### 2. The root `index.html` works index

The works index is the `<section class="works" id="works">` block in `index.html`. It is the visible portfolio. Every shipped demo gets a `<a class="work" ...>` row.

When **adding** a demo:
- Pick the next two-digit number (`01`, `02`, `03`, …). Numbering is **chronological by ship order**, never reused. If demo `02` is removed later, `02` stays retired — do not renumber existing entries.
- If there is a `data-status="soon"` placeholder slot at the right number, replace it with the live entry rather than appending after it.
- Update the `<div class="count">` text in the section header (`Index / NN entries`) to match the number of **shipped** entries (exclude `data-status="soon"` rows).
- Add the demo's display label to the `labels` map in the inline `<script>` so the cursor-follow preview shows the right title:
  ```js
  const labels = { sweden: "Svensk Mat", <new-key>: "<Display Title>" };
  ```
  The key matches `data-preview="<key>"` on the `<a class="work">` row.
- If after adding there are fewer than 3 visible rows total, top up with `data-status="soon"` placeholder rows so the index doesn't feel sparse. If there are 3+ shipped, drop the placeholders.
- Match the existing visual grammar: `<span class="num">`, `<span class="title">` with one word italicised in `<em>`, `<span class="tags">` (3 short uppercase phrases separated by `<br>`), `<span class="year">`, `<span class="arrow">→</span>`.

When **removing** a demo:
- Delete the demo's folder.
- Remove its row from the works index.
- Decrement the `Index / NN entries` count.
- Remove its key from the `labels` map.
- If the removed slot was in the middle (e.g. `02`), insert a `data-status="soon"` placeholder at that number to preserve numbering — do NOT renumber the entries that came after.

When **renaming** a demo:
- Move the folder to the new slug.
- Update the `href` on its works-index row.
- Update the `data-preview` key and the matching `labels` entry if the title changed.
- Update `README.md` link.

### 3. `README.md`

The README has a `## Live demos` section that mirrors the works index in plain markdown — one bullet per shipped demo with the path, title, and a one-line description. Keep it in sync any time the works index changes.

## Editorial / styling rules for the landing page

The landing is intentionally editorial — cream paper, grain overlay, Fraunces serif display, Inter body, JetBrains Mono for metadata. Don't drift from this without being asked.

- New works-index rows reuse the existing classes — do not invent new ones.
- The italicised word in each `<span class="title">` is the focal word; pick one that reads well as a serif italic (a noun, usually).
- Tags are 3 short uppercase phrases. Keep them concise; overlong tags break the right-hand column.
- The accent colour (rust orange `#b04a2f`) is reserved for hover, italic emphasis, and the live indicator. Don't use it for incidental UI.
- The marquee phrases at the top can be edited freely as new themes appear, but keep them short and italic-friendly.

## Deployment & verification

Pages serves whatever is on `main`. After pushing:

1. Wait ~30–60 seconds for the build.
2. Verify with `curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/<slug>/` — expect `200`.
3. Optionally `curl -s https://kalleeh.github.io/vibe-demos/ | grep -c "<expected text>"` to confirm the right content shipped (Pages caches; sometimes the first few requests return the previous build).

Do not enable workflows, custom domains, or branch-protection rules without the user asking. Pages settings live on the repo via `gh api repos/kalleeh/vibe-demos/pages` — only touch them on explicit request.

## Things to NOT do

- Do not introduce a build tool, framework, or package.json. Demos are plain static files.
- Do not share CSS between the landing and individual demos. The landing's editorial styling is bespoke; each demo has its own visual identity.
- Do not commit secrets, analytics scripts, or trackers.
- Do not force-push `main` unless the user asks.
- Do not edit `index.html` styling without preserving the editorial grammar described above.

## Sister repo

The `kalleeh/continuum` repo is unrelated and hosts the production Continuum iOS marketing site. Do not confuse the two — the user has explicitly separated demo work into this repo so Continuum can stay stable.
