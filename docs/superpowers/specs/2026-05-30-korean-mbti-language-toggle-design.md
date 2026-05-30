# korean-mbti — full-page English/Korean language toggle design

**Date:** 2026-05-30
**Demo:** `korean-mbti/index.html`
**Goal:** Add a header KO/EN toggle that switches the ENTIRE demo — test, 16-type
gallery, all UI chrome, AND the AI deep-read mode (prompt, canned outputs, samples)
— between Korean and English, live, with state preserved.

## Locked decisions

- **Scope:** Everything, including AI 깊이 읽기 mode (English prompt → Claude replies
  in English; English canned outputs; English sample passages).
- **Nicknames in EN:** Standard MBTI archetype titles (INTJ "The Architect", INFP
  "The Mediator", ENFP "The Campaigner", etc.) — NOT translated Korean memes.
- **Toggle:** Compact `KO / EN` switch in the header near `← 인덱스`. **Default KO**
  (current behavior). Persisted in `localStorage`.
- **Architecture:** Approach A — a centralized `STR` dictionary for fixed UI strings +
  paired `_ko`/`_en` fields on existing data objects. `t(key)` and `L(obj, field)`
  helpers, both with Korean fallback. NOT parallel content trees; NOT external JSON
  (must stay a self-contained single HTML file, no build, no fetch).

## Core mechanism

Near the top of the script, before any render code:

```js
const LANG_STORAGE = "vibe.korean-mbti.lang";
let LANG = localStorage.getItem(LANG_STORAGE) || "ko";   // default Korean
const t = (key) => (STR[LANG]?.[key] ?? STR.ko[key] ?? key);
const L = (obj, field) => (obj?.[`${field}_${LANG}`] ?? obj?.[`${field}_ko`] ?? obj?.[field]);
```

- `STR = { ko: {...}, en: {...} }` — every fixed UI string, keyed.
- `t("axesHeading")` → fixed UI string for current LANG, falls back to KO then the key.
- `L(type, "nickname")` → reads `nickname_en`/`nickname_ko` off a data object; falls
  back to KO then the bare field. **Fallback guarantees a partial translation never
  renders blank.**

## Data model changes (paired `_ko`/`_en` fields)

Existing single-language fields are renamed/augmented with language suffixes. Where a
field is already suffixed `_ko` (e.g. `reading_ko` in CANNED), add the `_en` twin.

| Object | Fields → paired | Notes |
|---|---|---|
| `TYPES` (16) | `nickname`→`nickname_{ko,en}`, `one_liner`→`_{ko,en}`, `vibes`→`vibes_{ko,en}` | EN nickname = standard archetype title |
| `QUESTIONS_FULL` (93) | `prompt`→`_{ko,en}`, `a.text`/`b.text`→`_{ko,en}` | choice `letter` unchanged |
| `FACETS` (20) | `left`/`right` → `_{ko,en}` | English pole names (Initiating/Receiving…) |
| `AXIS_LABELS` | move into `STR` (4 axes × left/right) | e.g. "E · 외향" / "E · Extraversion" |
| `DIAL_BUCKETS` (4) | `ko`→`label_{ko,en}`, `desc`→`_{ko,en}` | `han` (思感直覺) stays both langs |
| `FN_RANK_LABEL` | English side already present; ensure both | "Dominant · 주기능" → lang-split |
| `TEMPERAMENT_GROUPS` | `label`→`_{ko,en}` | "NT · 분석가" / "NT · Analysts" |
| `CANNED` (4) | each `_ko` value gets `_en` twin (`reading`, `evidence`, `reasoning`, `vibes`, `nickname`, `one_liner`); `matches` gains EN keywords | facet pole `left`/`right` paired too |
| `SAMPLES` (3) | `diary`/`kakao`/`reflect` → `_{ko,en}` | EN = authentic rewrite, not literal |
| AI prompt | `SYS_KO` (existing) + `SYS_EN` (new) | same XML structure, EN values |

Render functions (`renderResultHTML`, `renderFnStack`, `renderGallery`,
`renderGalleryDetail`, `renderQuestion`, the AI result renderer) change every Korean
string literal to `t(...)` and every data-field read to `L(obj, field)`.

## Toggle UI + behavior

Header markup near `← 인덱스`:
```html
<div class="lang-toggle" role="group" aria-label="Language">
  <button type="button" data-lang="ko" aria-pressed="true">KO</button>
  <button type="button" data-lang="en" aria-pressed="false">EN</button>
</div>
```
Styled to match the existing `.gender-toggle` grammar (small, mono, celadon active).

Handler:
```js
function setLang(l) {
  if (l === LANG) return;
  LANG = l;
  localStorage.setItem(LANG_STORAGE, l);
  document.documentElement.lang = l;        // <html lang> flips ko↔en
  syncLangToggle();                          // update both toggles' active/aria-pressed
  applyStaticStrings();                      // swap [data-i18n] chrome
  rerenderActivePanel();                     // re-render visible JS panel, preserving state
}
```
A delegated click listener on `[data-lang]` calls `setLang`. On load, `applyStaticStrings()`
+ `document.documentElement.lang = LANG` run once so a persisted EN choice paints
correctly.

## Two re-render surfaces

**1. Static HTML chrome** — header/title/sub, the three tab labels + `.meta`, intro
panel (length pickers), AI panel (instructions, hint columns, chips, placeholder, key
panel, buttons), footer. Each Korean text node gets `data-i18n="key"`; attributes
(placeholder, title, aria-label) get `data-i18n-attr="attr:key,attr2:key2"`.
`applyStaticStrings()` walks `document.querySelectorAll("[data-i18n]")` setting
`textContent = t(key)`, and `[data-i18n-attr]` setting each named attribute. Nodes with
inline `<em>` emphasis (title, subtitles) use a small set of keys whose `STR` values
contain the markup, applied via `innerHTML` for that whitelisted subset only.

**2. JS-rendered panels** — `rerenderActivePanel()` checks the active tab and current
state and re-runs the right render:
- test tab: if a result is shown, re-render result; else if mid-test, re-render current
  question; else the intro is static (covered by `applyStaticStrings`).
- gallery tab: re-run `showGalleryGrid()` or `showGalleryDetail(currentType)`.
- AI tab: if a result/canned output is shown, re-render it; else chrome is static.

State (quiz index, answers, shown result object, open gallery type) is already held in
module state, so re-rendering reads current language without losing position.

## AI deep-read mode (English)

1. **`SYS_EN`** — English translation of the domain-tuned `SYS_KO`, SAME XML tag spine
   (`<role>/<voice>/<reasoning_order>/<canonical_types>/<canonical_facets>/<errors_to_avoid>/<output_constraints>/<output_schema>/<exemplar>`).
   - `<voice>` instructs English output.
   - `<canonical_facets>` uses English pole names; `<canonical_types>` uses standard
     archetype titles.
   - `<output_schema>` field NAMES are identical to the Korean prompt's so the existing
     renderer consumes either language's response unchanged — only values differ.
   - This is a re-rendering of already-embedded domain knowledge, NOT a new research
     pass (per the project's "research once" rule).
   - Call site: `const sys = LANG === "en" ? SYS_EN : SYS_KO;`
2. **CANNED `_en` twins** — English `reading_en`, `evidence_en`, `vibes_en`,
   `reasoning_en`, `nickname_en`, `one_liner_en`, paired facet poles. `matches` arrays
   keep Korean keywords AND gain English keywords so canned mode triggers on English
   sample text. Canned selection runs against the input regardless of language.
3. **`SAMPLES` `_en`** — authentic English diary / casual-text / self-reflection
   rewrites (voice-matched, not literal), so canned EN mode works with no key.

## Service worker

Bump `vibe-korean-mbti-v12` → `v13` (HTML changed). No SHELL additions.

## `<html lang>` + meta

- `document.documentElement.lang` flips `ko`↔`en` on toggle and on load.
- The static `<html lang="ko">` stays as the default; JS overrides per stored pref.
- Meta description/og:description: keep Korean default; optionally swap on load via JS
  if EN (low priority — note as nice-to-have, not required).

## Out of scope (YAGNI)

- No third language; no RTL.
- No translation of the `← 인덱스` target (the root studio landing is its own demo).
- No per-string lazy loading or external files — all inline.
- No automatic re-translation of live Claude output (Claude outputs the language the
  prompt requests; we don't post-translate).
- Meta-tag swap is optional/nice-to-have, not a success criterion.

## Success criteria

- A KO/EN header toggle, default KO, persisted in localStorage, flips the WHOLE demo
  live without losing quiz/gallery/result state.
- `<html lang>` updates to match.
- Every surface from the inventory renders in the chosen language: UI chrome, 93
  questions + choices, 16 type nicknames/one-liners/vibes (EN = archetype titles), axis
  & facet labels, function stack, gallery (grid + detail + note), result screen,
  loading/error strings.
- AI mode: EN selection sends `SYS_EN` (Claude replies in English), canned EN outputs
  render, EN sample passages load. Schema field names identical across languages so the
  renderer is language-agnostic.
- Partial-translation safety: any missing `_en` value falls back to Korean, never blank.
- `node` inline-script syntax check passes; KO mode behaves exactly as before when
  LANG="ko" (no regression).
- Self-contained: no build, no external fetch, single HTML file.

## Verification notes

- Canned EN mode is fully self-verifiable (no key needed) — primary QA path.
- Live EN API path: structure verified against the renderer; a true end-to-end English
  API call requires the user's key and is flagged for user verification.
