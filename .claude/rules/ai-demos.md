---
paths:
  - "*/index.html"
---

# AI demo pattern

Demos that call Claude share one integration shape so each new demo cribs from the last. Reference implementation: `intake-companion/index.html` — read its `callClaude()` before tuning any new AI demo.

## Endpoint and auth

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

Never hardcode, commit, or log a key. The viewer pastes their own.

## Key handling (mobile-friendly)

- First load: a polite key-prompt panel with a "where do I get one?" link to console.anthropic.com.
- Store under a per-demo localStorage key (`vibe.<slug>.key`) — never share across demos.
- `<input type="password">` so the key shows as dots.
- "Paste from clipboard" button (`navigator.clipboard.readText()`) — critical for phone UX.
- "Forget my key" button that wipes localStorage.
- On a 401: wipe the stored key and re-show the prompt with a "key was rejected" hint.

## Canned-first, live-optional

Every AI demo ships two modes:
1. **Canned mode (default)** — pre-baked realistic outputs so the demo works with no key/signup. Must be visibly labeled ("demo mode" pill / italic note) so it never misrepresents itself as live.
2. **Live mode** — toggleable "use my own key" panel that switches to real calls.

## Streaming where it helps

Prefer the streaming endpoint (`stream: true`, SSE) for any human-readable text output — characters arriving in 200ms feels instant. Use non-streaming only when you need a complete JSON object before rendering (e.g. structured forms).

## Cost guardrails (set in console.anthropic.com, not in code)

Dedicated workspace + per-key spend cap ($5–10/mo); restrict the key to the three models above; email alerts at $1/$3/$5; rotate immediately if anything looks off.

---

# Domain-tuned system prompts

Generic prompts produce generic output the target audience rejects in seconds. **Before shipping any AI demo, do a one-shot research pass to embed real domain knowledge into the system prompt**, then never re-research on later runs. This is where most perceived quality lives — a strong prompt on Haiku beats a weak one on Opus.

Skip this only for purely aesthetic demos (shaders, particle effects) — no domain to tune for.

## When to do this pass

- The demo has a **single named audience** with vocabulary/conventions/canon an outsider gets wrong (clinical, legal, religious, regional, technical sub-specialty), AND
- It will be shown to **someone in that audience**, AND/OR it produces **structured output you cannot eyeball-correct**.

## Methodology

1. **Identify the audience precisely** — not "Korean speakers" but "a working 한의사 trained at a Korean 한의과대학". Specificity drives the prompt's voice.
2. **Spawn a research agent** (Explore/general-purpose) with a tight, audience-anchored brief. Tell it which sources to prefer (Korean canon not translated Chinese; primary not Wikipedia) and what NOT to bring back (generic Western analogues, hedged "consider consulting" tone).
3. **Extract these artefacts:**
   - **Canonical vocabulary** — named patterns/categories an expert commits to, in the audience's writing system (한글 + 한자 where it disambiguates, not Romanization).
   - **Canonical references** — 5–30 named works/formulas/codes/standards the audience cites.
   - **Errors-to-avoid list** — 8–15 specific ways an outsider model gets this wrong (the most under-rated section; does more work than the positive list).
   - **One worked exemplar** — a single fully-traced reasoning + output for a canonical case (for voice calibration, not copying).
4. **Compose with XML tags**, in this order: `<role>` (anchor identity incl. what they are NOT — negative anchoring blocks the common drift), `<voice>` (tone, hedging policy, naming, language priority), `<reasoning_order>` (numbered silent steps), `<canonical_*>` (the lists from step 3), `<errors_to_avoid>` (numbered, specific, actionable), `<output_constraints>` (counts/formats/limits), `<output_schema>` (the exact JSON/markdown shape, field guidance inline), `<exemplar>` (one calibrated input + trace + output, trace marked silent).
5. **Match the schema to existing rendering code.** If the demo has a stable JSON shape (canned briefs, templates), the new prompt's `<output_schema>` MUST match exactly — check rendering before changing schema.
6. **Calibrate against the canned outputs.** They're your ground truth; live output should read like one of them. If it doesn't, tighten `<voice>` and `<errors_to_avoid>`, not the canned briefs.

## Anti-patterns

- Skipping the research pass and writing from training-data memory.
- One huge unstructured prompt — XML tags exist because Claude follows structure far more reliably.
- Positive-only guidance ("be authentic") with no errors-to-avoid list.
- Re-running the research every session — do it once, embed the results, then only tune.
- Romanizing/translating the canon — if the audience reads 한글, the lists stay 한글.
