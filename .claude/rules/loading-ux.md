---
paths:
  - "*/index.html"
---

# Loading states and async UX

Every demo that does background work — LLM call, OCR, 3D asset load, audio analysis, speech recognition — must show **visible motion** while it works. Static "Loading…" text is forbidden; it makes the demo feel broken even when it isn't.

## What to show, by operation type

- **LLM call (streaming):** the response appears character-by-character as it arrives — the streaming text *is* the progress indicator, no separate spinner.
- **LLM call (non-streaming):** an indeterminate bar (thin animated gradient atop the response area) or a typographic shimmer through the placeholder. Avoid round spinners — generic, breaks the editorial tone.
- **Asset load (3D, textures, fonts):** a real progress bar from `THREE.LoadingManager`'s `onProgress`, or a `fetch` + `ReadableStream` reader. Show actual percentages.
- **OCR (Tesseract.js):** real progress via the `logger` callback; show stage labels ("recognizing", "rendering").
- **Speech recognition:** live interim transcripts streamed into the input as the user speaks — the partial text *is* the feedback.
- **Audio / generative visuals:** the visualization itself is the feedback; no separate loader.

## Visual rules

- Each demo picks loading vocabulary matching its own aesthetic — do NOT import or share a global spinner.
- Always honor `@media (prefers-reduced-motion: reduce)` — replace heavy animation with static/subtle-fade states.
- Never block the whole viewport with a full-screen overlay unless the operation genuinely blocks all interaction. Inline progress preserves agency.
- Empty/initial states should already have visual interest so the first paint isn't dead — pre-fill with lightly animated placeholder content.
