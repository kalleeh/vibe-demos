---
paths:
  - "*/index.html"
---

# AI demo pattern

Demos that call Claude share one integration shape so each new demo cribs from the last. Reference implementation: `intake-companion/index.html` — read its `solveProxyPoW()` and `callClaude()` (search for `CLAUDE_PROXY`) before wiring any new AI demo. The server side is `ai/pb/pb_hooks/proxy.pb.js` (a PocketBase JSVM hook that fronts Amazon Bedrock); read it too — it defines exactly what the browser may send.

Live callers today: `intake-companion`, `korean-mbti`, `live-globe`, `clinic-admin`, `changwon-homes`, `kids-bookshelf` (in `app.js`). All use the same `CLAUDE_PROXY` + `solveProxyPoW()` pair.

## Endpoint and auth

The browser never talks to Anthropic and never holds a key. Every call goes to the shared proxy at `https://ai.pb.gurum.se`, which keeps the Bedrock bearer token in a server-side env var and translates the request to Bedrock's `invoke` API. There is no key UI, no BYO key, no localStorage key, no model-ID picker — do not build any of them.

Anti-spam is a proof-of-work challenge, not authentication:

1. `GET /api/claude-challenge` → `{ nonce, exp, sig, difficulty }` (HMAC-signed, 2-minute TTL, 20 challenges/min/IP, origin-checked).
2. The browser brute-forces `counter` until `SHA-256(nonce + ":" + counter)` has ≥ `difficulty` leading zero bits (Web Crypto, ~0.5–1 s, once per call — the normal loading state covers it).
3. `POST /api/claude` with headers `X-PoW-Nonce`, `X-PoW-Exp`, `X-PoW-Sig`, `X-PoW-Counter` plus a JSON body. Each nonce is single-use; a replay 403s.

```js
const CLAUDE_PROXY = "https://ai.pb.gurum.se";
async function solveProxyPoW() { /* copy verbatim from intake-companion/index.html */ }

const pow = await solveProxyPoW();
const res = await fetch(CLAUDE_PROXY + "/api/claude", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...pow },
  body: JSON.stringify({
    model: "opus", max_tokens: 3500, system, messages,
    tools: [BRIEF_TOOL], tool_choice: { type: "tool", name: "clinical_brief" },
  }),
});
if (!res.ok) { const e = new Error("Proxy " + res.status); e.status = res.status; throw e; }
const data = await res.json(); // native Claude Messages response
const tu = (data.content || []).find(b => b.type === "tool_use" && b.name === "clinical_brief");
```

Request-body rules (enforced by `proxy.pb.js` — anything else 400s):
- `model` is a logical name: `"opus"` (default, the wow run) or `"sonnet"` (cheaper/faster, e.g. kids-bookshelf's fan-out). No Haiku, no dated model IDs — the mapping to Bedrock model IDs lives server-side only.
- `max_tokens` is capped at 4096.
- `stream: true` is rejected — **non-streaming only**. Design for one complete response (see `loading-ux.md`, the non-streaming branch: indeterminate bar or shimmer, not character-by-character).
- `tools` + `tool_choice` are forwarded when present. **For any structured output, force a tool call** (`tool_choice: { type: "tool", name }` with a JSON-schema `input_schema`) and read the `tool_use` block's `input` — never regex JSON out of prose.
- Proxy budget: 24 calls/min/IP and a global cap of 800 calls/day. A demo that fans out (kids-bookshelf: ~6 calls per recommendation) must stay inside that.

Origin allow-list is the Pages origin (`https://kalleeh.github.io`) plus `localhost`/`127.0.0.1` for dev — the demo on any other host gets 403.

## Canned-first, live-optional

Every AI demo ships two modes:
1. **Canned mode (default)** — pre-baked realistic outputs so the demo works with no network, no proxy, no budget. It MUST be visibly labelled ("demo mode" pill / italic note) so it never passes itself off as live.
2. **Live mode** — a toggle ("Try live mode →") that switches to real proxy calls.

Error-handling contract:
- `403` / `429` / `503` from the proxy (origin, PoW, rate limit, daily cap, proxy not configured) → fall back to the closest canned output AND say so on screen (intake: "라이브 데모가 잠시 바쁩니다 — 예시 결과를 보여드릴게요"). A canned result MUST never render under a live label.
- Any other failure → show the error inline; keep the previous output.
- MUST set a busy flag / disable the trigger for the whole call (challenge + PoW + fetch). Double-submits burn nonces and rate budget and race the render.
- MUST escape model output before any `innerHTML` (`esc()` in intake-companion) or render with `textContent`. Model text is untrusted input.

## Cost guardrails

Bedrock usage is billed to us, so the guardrails are server-side in `proxy.pb.js`: PoW difficulty, per-IP rate window, global `DAILY_CAP`. Tune them there, not in demos. If a demo needs more headroom, raise the cap in one commit and redeploy with `./sync-backends.sh` (see `pocketbase.md`, JS-hooks section).

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
