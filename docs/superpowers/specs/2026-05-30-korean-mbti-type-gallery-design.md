# korean-mbti — 16유형 도감 (type gallery) design

**Date:** 2026-05-30
**Demo:** `korean-mbti/index.html`
**Goal:** A beautiful, browsable gallery of all 16 MBTI types — portrait + result-style
detail for each — added as a third tab. Static, AI-free, reuses existing data and
render code.

## Motivation

The demo currently only surfaces a type after a person takes the test or runs the AI
read. There's no way to simply browse all 16 and see their portraits + framing. This
adds a "poster wall" the user can explore, and doubles as a soft funnel toward taking
the test.

## Scope (locked decisions)

- **Placement:** new third tab `16유형 도감` alongside `빠른 테스트` and `AI 깊이 읽기`.
- **Two internal views** in `#panel-gallery`, swapped via show/hide (same idiom as the
  test panel's `test-intro` / `test-running` / `test-result`):
  - `gallery-grid` (default) — the 16-card browse wall.
  - `gallery-detail` — one type's full screen, with a `← 도감` back button.
- **Detail depth:** full result screen layout, **minus the 4축 bars**.
- **Why the bars are dropped:** the 4축 confidence bars represent *a person's measured
  lean* (from their test/AI run). A generic type card has no person behind it, so real
  confidence numbers would be fake. In their place: a subtle inline note explaining
  this, ending in a link to the test tab.
- **Grid arrangement:** grouped by temperament into four labeled rows (NT/NF/SJ/SP),
  each section gently tinted with its bible palette (lavender / coral / sage / honey).
- **Portraits:** one portrait per card (the selected gender), NOT both. A single global
  女/男 toggle flips all cards + detail + result hero at once.
- **No new assets, no API calls, no dependencies.** Everything is built from data and
  images already in the repo.

## Data sources (all already in `index.html`)

- `TYPES` — per-type `{ nickname, one_liner, vibes }` for all 16 (lines ~1842–).
- `FN_STACKS` — per-type 4-function stack (lines ~1887–).
- `DIAL_BUCKETS`, `computeFnStrengths()`, `renderFnStack()` — the function-stack dial
  (already sorts #1→#4 after the recent ordering fix).
- `portraits/{women,men}/{type}.jpg` — 32 portraits already shipped.
- `getGender()` / `portraitPath(type)` — gender resolution + localStorage (lines ~2169–).

Temperament groups (for the four sections), matching the portrait style bible:

| Group label | Types | Palette anchor (tint) |
|---|---|---|
| NT · 분석가 | INTJ INTP ENTJ ENTP | lavender `#ADA7FF` |
| NF · 외교관 | INFJ INFP ENFJ ENFP | coral `#D96E54` |
| SJ · 관리자 | ISTJ ISFJ ESTJ ESFJ | sage `#9CAA8E` |
| SP · 탐험가 | ISTP ISFP ESTP ESFP | honey `#E3B25A` |

Section background wash ≈ 6–8% of the anchor over cream; label in the anchor color.

## Components

### Tab + panel (HTML)

- Add a third `.tab` button (`data-mode="gallery"`, `aria-controls="panel-gallery"`)
  with a `.meta` subtitle (e.g. `16유형 · 초상 도감`).
- Add `<section class="panel" id="panel-gallery">` containing two child divs:
  `#gallery-grid` and `#gallery-detail` (latter `display:none` initially).
- The existing tab-switch handler already toggles `.panel.active` / `.tab.active` by
  `data-mode` → `panel-<mode>`. Confirm it generalizes to a third tab (it iterates, so
  it should); if it hard-codes two modes, extend it.

### Grid render — `renderGallery()`

Builds the four temperament sections. For each type, a `.type-card`:

```
<button class="type-card" data-type="ENFP">
  <span class="type-card-thumb"><img src="portraits/<g>/enfp.jpg" loading="lazy" …></span>
  <span class="type-card-code">ENFP</span>
  <span class="type-card-nick">스파크</span>   <!-- first segment before " · " -->
</button>
```

- `<button>` for free keyboard/tap semantics; whole card clickable.
- Thumb cropped via `object-fit: cover` to a square-ish tile.
- `loading="lazy"` on all imgs so offscreen cards stream in.
- Hover/focus lift reuses the `.fn-dial:hover` `translateY(-1px)` + border idiom.
- Short nickname = `TYPES[type].nickname.split(" · ")[0]`.

### Detail render — `renderGalleryDetail(type)`

Reuses the result layout, minus 4축. To avoid duplication, **extract** the portrait
hero + 女/男 toggle from `renderResultHTML()` into a shared helper:

- `renderPortrait(type)` → the `.portrait-wrap` markup (hero img + gender toggle).
  `renderResultHTML()` is refactored to call it; the gallery detail calls it too.
- `renderFnStack(type)` → used verbatim.

Detail markup, top to bottom:
1. `← 도감` back button (returns to `gallery-grid`).
2. `renderPortrait(type)` — hero portrait + 女/男 toggle.
3. Type code (`ENFP`) + full nickname (`TYPES[type].nickname`).
4. One-liner (`TYPES[type].one_liner`).
5. Vibes chips (`TYPES[type].vibes`) — reuse `.vibe` styling.
6. **The note** (subtle italic gray, where bars would be):
   > 4축 막대는 ‘내’ 검사 결과에서만 나타나요 — 여기선 유형 고유의 결만 봅니다.
   > <a>내 축이 궁금하다면 → 빠른 테스트</a>
   The link calls the tab-switch handler to activate `빠른 테스트`.
7. `renderFnStack(type)` — the function-stack dials (already #1→#4 sorted).

### Interaction wiring

- **Grid card click** (`.type-card`): read `data-type`, call `renderGalleryDetail`,
  show `#gallery-detail`, hide `#gallery-grid`, scroll to top of panel.
- **`← 도감` back**: show `#gallery-grid`, hide `#gallery-detail`.
- **女/男 toggle (gallery):** reuse existing gender-set logic. On change, re-render the
  grid (all thumbs) and, if detail open, its portrait. The existing result-screen toggle
  handler already writes `getGender()` to localStorage; the gallery toggle shares it so
  all three surfaces (grid, detail, result hero) stay in sync. Wire via the existing
  delegated `[data-gender]` click handler if possible, else a small shared `setGender()`.
- **Test-link** inside the note: triggers the same code path as clicking the
  `빠른 테스트` tab.

## CSS additions (scoped, editorial grammar preserved)

- `.gallery-intro` / subtitle — mirror `.axes-sub` / `.fnstack-sub` styling.
- `.temperament-section` + `.temperament-label` — the four tinted group blocks.
- `.type-grid` — responsive grid: 4 cols desktop, 2 cols phone (`@media` mirrors the
  existing `.fnstack-grid` breakpoint at the same width).
- `.type-card`, `.type-card-thumb img`, `.type-card-code`, `.type-card-nick`,
  hover/focus lift.
- `.gallery-note` — the subtle italic note; reuse accent color for its link.
- Honor `prefers-reduced-motion` for the hover lift (match existing `.axis-fill`
  reduced-motion handling).

## Service worker

- Bump `vibe-korean-mbti-v11` → `v12` (HTML changed). Portraits are already covered by
  the runtime cache / SHELL; no SHELL change needed for the gallery (it reuses existing
  image paths).

## Out of scope (YAGNI)

- No per-type authored long-form descriptions (uses existing one_liner + vibes).
- No 4축 bars or fabricated confidence numbers in the gallery.
- No search/filter/sort controls — four labeled groups are the only organization.
- No deep-linking / URL routing to a specific type (in-app view swap only).
- No changes to the test or AI panels beyond the shared `renderPortrait` extraction.

## Success criteria

- New `16유형 도감` tab shows all 16 types grouped into 4 tinted temperament sections,
  each card with the selected-gender portrait + code + short nickname.
- Clicking a card opens a result-style detail (portrait + 女/男 toggle, nickname,
  one-liner, vibes, function stack) with the explanatory note instead of 4축 bars.
- The note's link jumps to the test tab.
- One global 女/男 toggle keeps grid, detail, and result hero in sync.
- No new images committed; no AI calls; page weight increase is negligible.
- `node` syntax check on inline scripts passes; existing test/AI flows unchanged.
