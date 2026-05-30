# korean-mbti — serene reskin + portrait gender toggle

**Date:** 2026-05-30
**Demo:** `korean-mbti/` (works index #05)
**Type:** Visual reskin + small feature (no logic/test changes)

## Goal

Move the demo away from its current dark navy/rust "midnight" theme to the
serene cream-paper + celadon Korean aesthetic established by
`intake-companion/`. The demo is often used by Korean women; it should feel
calm, warm, and inviting without overselling itself — it is a nicely made MBTI
test, not a one-of-a-kind product. Also wire up a women/men portrait toggle so
the watercolor art can be regenerated per-gender later.

The test logic, question pools (28 quick / 93 full), AI deep-read prompt, axis
analysis, and function-stack dials are **out of scope** — untouched. This is a
skin pass plus one small UI feature.

## Naming

The "16" was never wrong — it refers to the 16 MBTI types. The number stays.
Only the wordmark wording changes, to read warmer.

- **Wordmark (header masthead):** `MBTI · 성격의 결` — italic accent on **결**
  (`<em>`). 결 = the grain/texture of wood/fabric; "성격의 결" is natural,
  quietly literary Korean, not corny.
- **Eyebrow (mono):** `KOREAN MBTI READ`
- **Sub:** `짧은 검사로 16유형을 읽고, 내 결을 들여다보는 시간`
- **Browser `<title>` / OG title:** `MBTI · 성격의 결 — Korean MBTI Read`
- **Meta description / OG description:** keep the existing meaning
  (짧은 한국식 MBTI 테스트와 자유 텍스트 기반 AI 깊이 읽기).
- **PWA:** manifest `name` → `MBTI · 성격의 결 — Korean MBTI Read`,
  `short_name` → `MBTI 결`, apple-mobile-web-app-title → `MBTI 결`.

## Visual reskin

Source of truth for the palette/treatment is `intake-companion/index.html`.

### Palette (`:root`)

| Current token | Current value | New value |
|---|---|---|
| `--bg` | `#1a2238` (navy) | `#f5efe2` (cream paper) |
| `--bg-2` | `#232c47` | `#ece6d4` |
| `--paper` | `#f3ede1` | repurpose as ink-on-paper context; body text becomes ink |
| `--ink` | `#14110d` | `#1f2620` |
| `--ink-soft` | `#4a4537` | `#6c7669` (muted) + `#9ca596` (faint) |
| `--accent` | `#9a2a2a` (oxblood) | `#b54a32` (soft rust) |
| `--accent-2` | `#c75a3a` | `#48695a` (celadon-dark) for emphasis, `#6b9482` celadon |
| `--gold` | `#c8a35a` | retire or fold into celadon; gold no longer primary |
| `--line` | cream-on-dark rgba | `rgba(31,38,32,0.14)` (ink-on-cream) |
| `--line-strong` | cream-on-dark rgba | `rgba(31,38,32,0.22)` |

Add celadon tokens: `--celadon: #6b9482`, `--celadon-d: #48695a`.

The body now reads dark ink on cream paper (inverse of today). Every place that
assumed light-text-on-dark must be checked: tabs, mode pills, model toggle,
length cards, progress bar, axis bars, function-stack dials, buttons, vibes
chips, secondary-type block. Most read from the `:root` tokens; a few have
hardcoded rgba values or gradients (e.g. `linear-gradient(90deg, var(--accent),
var(--accent-2), var(--gold))` shimmer, the `rgba(200,163,90,0.12)` gold wash)
that need recoloring to the celadon/rust pair.

### Background & grain

- Replace the body's dark radial-gradient glow with the cream base + the
  `body::before` SVG **paper-grain overlay** copied from intake-companion
  (`feTurbulence` noise, `mix-blend-mode: multiply`, opacity ~0.55).
- Honor `@media (prefers-reduced-motion: reduce)` (existing reductions stay;
  grain is static so it's fine).

### Fonts

Keep Noto Serif KR + Noto Sans KR + JetBrains Mono. Replace the **Fraunces**
display italic with **Cormorant Garamond** italic to match intake-companion's
serene display voice. Update the Google Fonts `<link>` accordingly (drop
Fraunces axis, add Cormorant Garamond italics). Display masthead + the share
card masthead both switch Fraunces → Cormorant Garamond.

### Meta / theme color

- `<meta name="theme-color">` `#1a2238` → cream `#f5efe2` (or celadon — match
  intake-companion's choice; use `#f5efe2`).
- `apple-mobile-web-app-status-bar-style` `black-translucent` → `default`.
- manifest `theme_color` `#1a2238` → `#f5efe2`; `background_color` stays cream.

### Share card (canvas, `renderResultCard`)

The card is already cream-paper internally — good. Recolor only the accents:
- grain dots: currently `#1a2238` / `#9a2a2a` → `#48695a` / `#b54a32`.
- accent rule + masthead underline: `#9a2a2a` / `#c75a3a` → `#b54a32` / `#6b9482`.
- masthead font Fraunces → Cormorant Garamond (italic), Noto Serif KR fallback.
- pull-quote quote-mark color `#9a2a2a` → `#b54a32`.
- It must read the selected gender for the portrait (see below).

### icon.svg

Recolor to the new palette: keep the cream rounded-rect ground; the I/N/T
letters from navy `#1a2238` → ink `#1f2620`; the highlighted **F** and the
studio dot from oxblood `#9a2a2a` → celadon-dark `#48695a` (or soft rust
`#b54a32` — pick one; use celadon-dark so the icon reads distinctly Korean-green).

## Portrait gender toggle

### File structure (set up now, art regenerated later)

- Create `portraits/women/` and move the existing 16 `*.jpg` into it.
- Create `portraits/men/` and copy the same 16 files in as **placeholders**, so
  men renders immediately. They get replaced when the art is regenerated.

### UI

- On the **result card** add a small `여 / 남` (女/男) segmented toggle near the
  type hero. Default **여** (women — primary audience).
- Selecting flips the hero portrait `src` to `portraits/${gender}/${type}.jpg`
  and re-renders without recomputing the result.
- Persist choice in `localStorage` key `vibe.korean-mbti.gender` (`"women"` |
  `"men"`), read on load, default `"women"`.

### Code touch points

- `portraitSrc` in the result renderer (currently `portraits/${type}.jpg`) →
  `portraits/${gender}/${type}.jpg`.
- `renderResultCard`'s `portraitSrc` likewise reads the selected gender.
- The toggle handler lives with the other result-actions handlers.

### Service worker

- `sw.js` SHELL precache paths: `./portraits/infj.jpg` etc. →
  `./portraits/women/infj.jpg` etc. (keep the same 4 canned types).
- Bump cache `vibe-korean-mbti-v8` → `v9`.

## Maintenance contract

- Root `index.html` works-index row #05: update the `<span class="title">` to
  the new wordmark grammar (`MBTI · 성격<em>의 결</em>` or similar with one
  italic focal word) and refresh `<span class="tags">` if wording drifts. Year
  stays 2026; count unchanged (still a shipped demo, no add/remove).
- `README.md` `## Live demos` bullet for korean-mbti: update title to match.
- Thumbnail `thumbs/mbti.jpg`: out of scope this round (regenerate alongside the
  new portrait art later). Note it stays the old dark thumb until then.

## Out of scope (explicitly deferred)

- Regenerating the watercolor portraits themselves (women + men sets) — done in
  a later pass; structure is wired now so it's a drop-in.
- New `thumbs/mbti.jpg` — regenerate with the new art later.
- Any change to questions, scoring, AI prompt, dials, or copy beyond the
  wordmark/sub.

## Verification

- Load `korean-mbti/` locally; confirm cream/celadon theme, paper grain,
  legible ink text across: tabs, length cards, test-running progress, result
  card, AI panel, model toggle, mode pill.
- Run a quick test → result renders with women portrait by default; 여/남 toggle
  flips the image; reload preserves choice.
- Save result card → cream card with celadon/rust accents + selected-gender
  portrait, Cormorant masthead.
- After deploy: `curl -s -o /dev/null -w "%{http_code}\n"
  https://kalleeh.github.io/vibe-demos/korean-mbti/` → 200; grep landing for the
  new wordmark.
