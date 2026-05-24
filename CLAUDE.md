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

## Future ideas

A queued backlog of demo pitches with scope, tech, and audience notes lives in [IDEAS.md](./IDEAS.md). When the user asks "what should we build next" or "give me ideas", read that file rather than re-pitching from scratch. When a queued pitch ships, mark it `🟢 shipped` there.

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

## AI demo pattern

Demos that call Claude follow the same integration shape so each future demo can crib from the last instead of re-deciding the basics.

### Endpoint and auth

Browser-direct call to the Anthropic Messages API. No SDK bundle — raw `fetch`:

```js
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": userKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  },
  body: JSON.stringify({ model, max_tokens, system, messages }),
});
```

Three models, exposed as a UI toggle the viewer can flip mid-demo:

- `claude-opus-4-7` — default, the wow run
- `claude-sonnet-4-6` — balance
- `claude-haiku-4-5` — fast/cheap

Never hardcode a key. Never commit a key. Never log a key. The viewer pastes their own.

### Key handling (mobile-friendly)

- First load: a polite key-prompt panel with a "where do I get one?" link to console.anthropic.com.
- Store under a per-demo localStorage key (e.g. `vibe.intake-companion.key`) — never share a key entry across demos.
- `<input type="password">` so the key shows as dots on screen.
- "Paste from clipboard" button using `navigator.clipboard.readText()` — critical for phone UX.
- "Forget my key" button that wipes localStorage.
- On a 401 response: wipe the stored key and re-show the prompt with a "key was rejected" hint.

### Canned-first, live-optional

Every AI demo ships in two modes:

1. **Canned mode (default for first-time visitors)** — pre-baked realistic example outputs so the demo works with no key, no signup, no friction. This is what most viewers will see.
2. **Live mode** — toggleable "use my own key" panel that switches to real Claude calls.

Canned mode must be visibly labeled (a small "demo mode" pill, italic note, etc.) so it never misrepresents itself as live output.

### Streaming where it helps

Prefer the streaming endpoint (`stream: true`, SSE) for any demo where the output is human-readable text — even a 2s call feels instant when characters start arriving in 200ms. Use non-streaming only when the demo needs a complete JSON object before rendering anything (e.g. structured forms).

### Cost guardrails (set in console.anthropic.com, not in code)

- Dedicated workspace + per-key spend cap ($5–10/month is plenty for demo traffic).
- Restrict the key to the three models above so a leaker can't pivot to anything wilder.
- Email alerts at $1 / $3 / $5 thresholds.
- Rotate the key immediately if anything looks off.

## Domain-tuned system prompts

Generic prompts produce generic output. Every AI demo aims at a specific audience — a 한의사, a KOGAS engineer, a Korean traveller in Stockholm — and a generic "you are an assistant" prompt will read as obviously foreign to that audience. **Before shipping any AI demo, do a one-shot research pass to embed real domain knowledge into the system prompt**, then never re-do that research on subsequent runs.

This is where most of the perceived quality lives. A weak prompt on Opus will lose to a strong prompt on Haiku.

### When to do this pass

- The demo has a **single named audience** with vocabulary, conventions, or canon that an outsider would get wrong (clinical, legal, religious, regional, technical sub-specialty).
- The demo will be shown to **someone in that audience**. They will spot generic AI-translated language in seconds.
- The demo produces **structured output you cannot easily eyeball-correct** (clinical brief, legal summary, formula recommendation, engineering risk assessment).

If the demo is purely aesthetic (a flame shader, a particle text effect), skip this — there's no domain to tune for.

### The methodology

1. **Identify the audience precisely.** Not "Korean speakers" — "a working 한의사 trained at a Korean 한의과대학". Not "engineers" — "a KOGAS pipeline integrity engineer reading a Korean-language risk twin". Specificity is everything; the prompt's voice should make sense to *that one person*.

2. **Spawn a research agent (Explore or general-purpose) with a tight, audience-anchored brief.** Tell it which sources to prefer (Korean canon, not translated Chinese; primary sources, not Wikipedia; current Korean clinical guidelines, not US ones). Tell it what NOT to bring back (generic Western analogues, hedged "consider consulting" tone).

3. **Extract these artefacts from the research:**
   - **Canonical vocabulary** — the named patterns / categories / objects an expert would commit to. Include the writing system the audience reads in (한글 + 한자 where it disambiguates, not Romanization).
   - **Canonical references** — the works, formulas, codes, standards, dashboards, datasets the audience cites. Surface 5-30 named items the model can pick from.
   - **Errors-to-avoid list** — the 8-15 specific ways an outsider model will get this wrong. This is the most under-rated section; it does more work than the positive list.
   - **One worked exemplar** — a single fully-traced reasoning + output for a canonical case. The model uses this to calibrate voice, not to copy.

4. **Compose the prompt with XML tags** (Anthropic best practice for structured prompts). Use these tags as the spine, in order:
   - `<role>` — anchor identity precisely. Include what they are AND what they are NOT (예: "you are a 한의사, NOT a TCM 中醫 practitioner"). Negative anchoring blocks the most common drift.
   - `<voice>` — tone, hedging policy, naming conventions, language priority.
   - `<reasoning_order>` — explicit numbered steps the model takes silently before producing output. Forces domain-correct reasoning shape.
   - `<canonical_*>` — the vocabulary and reference lists from step 3. Tell the model to stay within these (or clearly state when it needs to combine two).
   - `<errors_to_avoid>` — numbered list, each one specific and actionable. "Do NOT use TCM-translated English as the primary voice." Not "be culturally appropriate."
   - `<output_constraints>` — counts, formats, length limits.
   - `<output_schema>` — the JSON shape (or markdown shape) it must produce. Include field-level guidance inline.
   - `<exemplar>` — one calibrated input + reasoning trace + output. Mark the trace as silent so the model doesn't echo it.

5. **Match the schema to existing rendering code.** If the demo already has a stable JSON shape (canned briefs, rendering templates), the new prompt's `<output_schema>` MUST match exactly — otherwise live mode renders broken. Check rendering before changing schema.

6. **Calibrate against the canned outputs.** The hand-crafted canned briefs are your ground truth. The live-mode output should read like one of them — same voice, same depth, same naming conventions. If it doesn't, tighten the `<voice>` and `<errors_to_avoid>` sections, not the canned briefs.

### Anti-patterns

- **Skipping the research pass and writing the prompt from training-data memory.** This produces plausible-sounding generic output that the target audience immediately rejects.
- **One huge unstructured prompt.** XML tags exist because Claude follows structured instructions far more reliably than prose walls.
- **Positive-only guidance.** "Be authentic" without an errors-to-avoid list lets the model drift. Tell it specifically what wrong looks like.
- **Re-running the research every session.** The point is to do it once and embed the results. Subsequent edits tune the prompt; they don't re-research.
- **Romanizing or translating the canon.** If the audience reads 한글, the canonical lists stay in 한글. If they read 漢字, keep the 漢字. Translation drains authenticity.

### Reference implementation

`intake-companion/index.html` — `callClaude()`'s `sys` variable is the canonical worked example. Read it before tuning any new AI demo's prompt.

## Loading states and async UX

Every demo that does background work — LLM call, OCR, 3D asset load, audio analysis, speech recognition — must show **visible motion** while it works. Static "Loading…" text is forbidden; it makes the demo feel broken even when it isn't.

### What to show, by operation type

- **LLM call (streaming):** the response itself appears character-by-character as it arrives. No separate spinner needed once streaming has started — the streaming text *is* the progress indicator.
- **LLM call (non-streaming):** an indeterminate bar (thin animated gradient at the top of the response area) or a typographic shimmer through the placeholder text. Avoid round spinners — they're generic and break the editorial tone.
- **Asset load (3D models, textures, fonts):** a real progress bar driven by `THREE.LoadingManager`'s `onProgress` callback, or a `fetch` + `ReadableStream` reader. Show actual percentages.
- **OCR (Tesseract.js):** real progress via the `logger` callback; show stage labels ("recognizing", "rendering").
- **Speech recognition:** live interim transcripts streamed into the input as the user speaks — the partial text *is* the feedback.
- **Audio / generative visuals:** the visualization itself is the feedback; no separate loader needed.

### Visual rules for loaders

- Each demo picks loading vocabulary that matches its own aesthetic — do **not** import or share a global spinner. The landing page is editorial; a 3D demo might be neon-on-black; a clinical demo might be celadon-on-cream. Loaders match.
- Always honor `@media (prefers-reduced-motion: reduce)` — replace heavy animation with static or subtle-fade states.
- Never block the whole viewport with a full-screen overlay unless the operation genuinely blocks all interaction. Inline progress preserves agency.
- Empty/initial states should already have visual interest so the first paint isn't dead — pre-fill with placeholder content, animated in lightly.

## Things to NOT do

- Do not introduce a build tool, framework, or package.json. Demos are plain static files.
- Do not share CSS between the landing and individual demos. The landing's editorial styling is bespoke; each demo has its own visual identity.
- Do not commit secrets, analytics scripts, or trackers.
- Do not force-push `main` unless the user asks.
- Do not edit `index.html` styling without preserving the editorial grammar described above.

