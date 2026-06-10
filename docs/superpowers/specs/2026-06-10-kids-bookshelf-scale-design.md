# 책친구 — Scale the catalog + upgrade the (non-LLM) recommender

**Date:** 2026-06-10
**Slug:** `kids-bookshelf` (existing demo, entry #11)
**Status:** design approved, spec under review

## Goal

Two coupled upgrades to the shipped kids-bookshelf demo:
1. **Drastically more books** — grow the catalog from 88 to **~300–500 real, verified titles**.
2. **Better recommendations with NO runtime LLM** — replace the crude `scoreBook` with a
   strong deterministic engine (free-text lexicon, weighted features, a build-time quality
   prior, and a diversity pass).

The optional per-book AI "polish the prose" layer (the `book_blurb` tool calls) stays exactly
as-is — it enriches the *wording* of already-chosen recommendations and is never the
recommender. The recommender itself is 100% deterministic and offline by default.

## Hard constraint (user)

**No LLM for recommendations, by default.** Ranking must be deterministic, instant, and work
fully offline. An offline build-time LLM pass to *enrich the catalog* is allowed (it is not a
runtime recommendation). We explicitly rejected: an in-browser embedding model (~110MB
download) and a server-side embedding model (AWS Bedrock cost/dependency, or a self-hosted
sidecar that risks the 2GB Lightsail box shared with 8 other backends). Embeddings require a
model to run *somewhere* that does tensor math; none of the three hosting options were worth
it for this demo. The lean deterministic engine is the chosen path.

## Architecture: build-time vs runtime

### Build-time (offline, in `scripts/`, never ships to the browser)

A Node pipeline that produces the static `kids-bookshelf/catalog.js`:

1. **Source real titles** from known, finite, well-documented lists (so the LLM picks from
   real canon rather than inventing): Caldecott Medal + Honor, Kate Greenaway Medal,
   Korean 권장도서 (어린이도서연구회 / 세종도서 문학나눔), and major picture-book author
   backlists (백희나, 권정생, 이수지, Eric Carle, Julia Donaldson, Mo Willems, Oliver Jeffers…).
2. **Enrich** each title with a one-time LLM pass (via the existing Bedrock proxy or a local
   call — build-time only): assign `themes[]`, `mood[]`, `ages[]`, `level`, a Korean `blurb`,
   a Korean `readAloud`, and `cover{emoji,palette}`, all constrained to the controlled vocab.
3. **Quality prior** — assign `quality` (0–1) at build time: award winners/long-canonical
   staples score higher. Used as a small ranking nudge so classics surface.
4. **Verify (source-constrained + sampled)** — constrain sourcing to the real lists, then
   programmatically check a *sample* against Open Library (EN ISBNs) / Aladin (KR titles),
   and drop low-confidence entries. Report the confidence level; do not claim all-verified.
5. Emit `catalog.js` in the **existing append-only shape** (so scoring/rendering/AI all keep
   working unchanged), plus the new `quality` field. Keep `source:"curated"`.

The catalog stays a **single static `catalog.js`** (~a few hundred KB for 400 books) — no
backend, no fetch, works offline. Append-only schema preserved.

### Runtime (browser, deterministic, zero network)

Replace `scoreBook(b, p)` and tune `recommend2`:

- **Free-text lexicon** — a keyword→theme/mood map applied to the parent's note:
  - "티라노/브라키오/공룡/다이노" → boost 공룡
  - "잠들기 전/재우려고/자기 전/잠자리" → boost 잠자리 + 잔잔한
  - "무서워해요/무서워하는" → downweight 모험
  - "웃긴/까르르/웃겨" → boost 웃긴
  - (a few dozen entries; lives in `catalog.js` or `app.js` as a plain map)
  This replaces today's naive `note.includes(theme)` substring check.
- **Weighted features** (deterministic sum):
  - primary theme (first in `b.themes`) match weighted higher than secondary matches
  - age-fit curve: exact band best, adjacent soft, far penalized (keep current shape)
  - mood overlap
  - small `quality` prior nudge
  - lexicon-derived boosts from the note
- **Diversity pass (MMR-style)** — after scoring, greedily select the top set so it spans
  *different* primary themes rather than 6 near-duplicates, while preserving the **3 KR + 3 EN**
  balance and the score ranking. This is the single biggest perceived-quality fix.
- Keep the **varied reroll** (`pickVaried` / `shuffleSalt`) and the **per-book AI polish**
  layer unchanged — both sit on top of the new scorer.

## Files

- `scripts/build-catalog.mjs` (new) — the offline sourcing+enrichment+verify pipeline. Node,
  never shipped. Documents its sources. Re-runnable.
- `scripts/sources/*.json` (new, optional) — raw sourced title lists (award lists etc.) the
  enrichment reads, so sourcing is auditable and re-runnable without re-querying.
- `kids-bookshelf/catalog.js` (regenerated) — ~300–500 books, new `quality` field, same shape.
- `kids-bookshelf/app.js` (modified) — new `scoreBook`, lexicon, diversity pass in `recommend2`.
- `kids-bookshelf/CATALOG.md` (updated) — document `quality`, the lexicon, the build script.
- `kids-bookshelf/sw.js` — cache bump.
- Root `index.html` works-index row description may get a light touch (book count); `README.md` likewise.

## Out of scope (YAGNI)

- Embeddings / any runtime model call (rejected above).
- A search backend / PocketBase for the catalog (stays static).
- Per-book custom cover illustrations at this scale (keep the SVG-emoji + Open Library swap).
- Changing the AI polish layer or the proxy.

## Verification

- Catalog: the existing node validator (vocab/shape/dup-id) + the sampled
  Open Library/Aladin check + a manual spot-check of ~15-20 titles across KR/EN. Report
  confidence honestly (the original 88-book pass had fabrications caught in review — same
  discipline applies, scaled).
- Engine: node smoke tests (a profile in → 6 balanced, diverse books out, no dup, lexicon
  maps a sample note correctly) + headless render of several distinct profiles to confirm
  diversity (e.g. a 공룡-only note no longer returns 6 dino books) and that reroll still varies.
- Deploy: curl 200 + a live render walkthrough.

## Risks

- **Sourcing 300–500 real books is the hard, quality-sensitive part.** LLM enumeration of
  real titles with correct Korean metadata is fabrication-prone (bit us at 88). Mitigation:
  constrain to finite real lists, verify a sample, drop low-confidence, review before ship.
- Build may yield fewer than 500 after dropping unverifiable entries — that's acceptable
  (real over count, same principle as the original catalog).
