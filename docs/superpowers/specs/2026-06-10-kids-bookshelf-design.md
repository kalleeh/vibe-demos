# 책친구 (Book Friend) — Kids Book Recommender

**Date:** 2026-06-10
**Slug:** `kids-bookshelf`
**Works-index entry:** #11
**Status:** design approved, spec under review

## Concept

A Korean-language, mobile-first kids' book recommender. A parent taps in their child's
profile — age band, gender, interest chips, mood — plus an optional free-text note, and
receives ~6 book recommendations drawn from **two pools**: real Korean picture books and
real English picture books, each clearly flagged 🇰🇷 / 🇬🇧 so bilingual / Korean families
raising kids in both languages can build both shelves at once.

The voice and UI are entirely in Korean (`lang="ko"`). The audience is a Korean parent of a
0–9-year-old.

## Engine — curated + AI hybrid (canned-first, live-optional)

### Catalog mode (default — no key, instant, offline-capable)

- A hand-curated catalog of **~90 real titles at launch** (≈half Korean 그림책 canon,
  ≈half English picture-book canon), each tagged with age bands, themes, mood, and reading
  level.
- Rule-based scoring ranks the catalog against the profile and returns the top 6 — balanced
  to roughly **3 Korean + 3 English** when both pools have matches (degrades gracefully if a
  narrow filter starves one pool).
- A "다시 추천 🎲" control reshuffles among the qualified set so repeat taps feel alive.
- The "왜 이 책일까요?" blurb in catalog mode is assembled from per-book curated sentences.
- This is the **canned mode** — visibly labeled with a "추천 예시" / demo-mode pill so it is
  never mistaken for live AI output.

### AI mode (optional upgrade)

- Uses the **shared Bedrock proxy** (`ai.pb.gurum.se`) — the same server-side Claude pattern
  as changwon-homes / intake-companion. **No BYOK** (proxy handles auth + PoW anti-spam).
- Claude receives the full profile **including the free-text note**, plus the catalog as
  grounding context, and **streams** personalized 추천 이유 + read-aloud tips per book.
- Anti-hallucination: the model picks primarily **from the catalog**, but may add 1–2
  off-catalog "도전 추천" picks, clearly marked as AI suggestions (distinct from curated).
- The prompt is built per the repo's **domain-tuned system-prompt methodology** (XML-tagged:
  `<role>` = a Korean children's-librarian / 그림책 큐레이터; `<voice>`; `<canonical_*>` =
  the catalog passed at call time; `<errors_to_avoid>`; `<output_schema>` matching the card
  render shape). Built once via a research pass, then embedded.

## Extensibility — a first-class goal

The catalog must grow to **hundreds of titles over time** with zero logic changes:

- Catalog lives in a standalone **`catalog.js`** as a flat array of plain-data objects.
- Adding a book = appending one object. No scoring/render/prompt edits required.
- Scoring, rendering, and AI-grounding all read the catalog **dynamically** at runtime.
- A schema comment block at the top of `catalog.js` (mirrored in a short `CATALOG.md`)
  documents fields + curation rules so future passes append cleanly.
- Each entry carries a **`source`** field (`"curated"` initially). AI-suggested titles that
  prove good can later be promoted to `"curated"` — the field is the migration path.

### Catalog entry schema (draft)

```js
{
  id: "kr-gureumppang",          // stable kebab slug, never reused
  lang: "ko",                    // "ko" | "en"  → drives 🇰🇷 / 🇬🇧 flag
  title: "구름빵",                // canonical title in its own script
  titleRoman: "Gureumppang",     // optional, for EN-reader reference only
  author: "백희나",
  publisher: "한솔수북",
  ages: ["3-4", "5-6"],          // one or more of "0-2","3-4","5-6","7-9"
  level: "그림책",                // "보드북" | "그림책" | "책읽기" | "초기챕터북"
  themes: ["일상", "환상", "가족"],// matched against interest chips
  mood: ["따뜻한", "잔잔한"],      // matched against mood selection
  blurb: "비 오는 날 …",          // curated why-it-fits sentence(s)
  readAloud: "의성어를 …",        // curated read-aloud tip (one line)
  cover: { emoji: "☁️", palette: ["#cfe3f2","#fff"] }, // for SVG placeholder
  isbn: "9788980693573",         // optional; EN titles use it for real-cover swap
  source: "curated"              // "curated" | "ai"
}
```

(Final field set may tighten during build; this is the working shape.)

## Recommendation cards

Each card shows, in this order:

1. 🇰🇷 / 🇬🇧 flag
2. Cover (see below)
3. Title + author (and publisher, small)
4. **Level badge** — 보드북 / 그림책 / 책읽기 / 초기챕터북
5. **왜 이 책일까요?** — why-it-fits (curated sentence, or streamed AI reasoning)
6. **함께 읽기 팁** — one-line read-aloud tip

### Cover art — never-broken policy

- Every card renders a **crayon-styled generated SVG mini-book first**: a hand-drawn book
  frame with the entry's emoji, palette, and title in a wobbly frame. Cohesive with the
  aesthetic, zero broken images, instant.
- For **English titles with a known ISBN**, the real cover from **Open Library**
  (`covers.openlibrary.org`) lazily swaps in over the placeholder once it loads; on error it
  silently stays on the placeholder.
- **Korean titles stay on the illustrated placeholder** (Aladin's image API needs a key;
  hotlinking is unreliable). Cover art thus always ships and can never look broken.

## Look & feel — crayon picture-book

Per the approved preview: cream paper, wobbly hand-drawn borders (SVG turbulence filter
and/or per-element border-radius jitter), fat pastel interest chips with leading emoji, a big
crayon CTA button (책 찾아주세요! ✏️), gentle wiggle on chip selection. Results "draw onto"
the page one card at a time. Bright kid palette, distinct from the editorial landing — its
own visual identity (no shared CSS).

`prefers-reduced-motion: reduce` honored throughout (replace wiggle/draw-on with subtle
fades). AI loading state = a **crayon scribble progress line** with streaming text appearing
as it arrives (the stream itself is the progress indicator once characters land).

## Input UX — playful picker + free text

- **나이** (age band): 0–2 / 3–4 / 5–6 / 7–9 — single select, tappable.
- **성별**: 남아 / 여아 / 상관없음 — single select (purely a soft scoring nudge, never a hard
  filter; 상관없음 is the default).
- **좋아하는 것** (interests): multi-select emoji chips — 공룡 🦖, 우주 🚀, 동물 🐱, 공주 👑,
  자동차 🚗, 그림그리기 🎨, 잠자리 책 🌙, 탈것 🚂, 자연 🌳, 음식 🍪, 가족 👨‍👩‍👧, 친구 🤝 …
- **분위기** (mood): 웃긴 / 따뜻한 / 모험 / 학습 / 잔잔한 — multi-select.
- **한마디** (free text, optional): e.g. "요즘 공룡에 푹 빠져있어요" — used by AI mode for
  personalization; in catalog mode it lightly boosts theme matches via keyword scan.

## Plumbing (repo maintenance contract)

Same commit must include:

- `kids-bookshelf/index.html` (self-contained) + `kids-bookshelf/catalog.js`
- PWA shell: `manifest.webmanifest`, `icon.svg` (distinctive crayon-book glyph), `sw.js`
  (cache `vibe-kids-bookshelf-v1`, network-first HTML, cache-first assets, **skip
  `ai.pb.gurum.se` + `covers.openlibrary.org`** from caching).
- Root `index.html`: replace a `data-status="soon"` slot (or append) with work **#11** row —
  num `11`, italic focal word in the title, 3 uppercase tags, inline `<span class="thumb">`,
  year, arrow. Bump `Index / 10 entries` → `Index / 11 entries`. Drop a placeholder if 3+
  shipped remain visible (they do).
- `thumbs/kids-bookshelf.jpg` (1280×720).
- `README.md` `## Live demos` bullet.
- `CATALOG.md` (or header block) documenting the catalog schema + how to append.

**No PocketBase backend** — no shared/persistent state (recommendations are stateless per
session). Stays client-only per the decision tree.

## Out of scope (YAGNI)

- Buy / borrow links (deselected by user).
- User accounts, saved shelves, favorites persistence.
- Real bookstore / Aladin APIs.
- Ratings, reviews, reading logs.
- Korean real-cover fetching (placeholder-only for KR).

## Build sequence (for the plan)

1. Research pass → curate the ~90-title catalog (real KR + EN canon, correct 한글
   titles/authors/publishers) + assemble the AI prompt's canonical lists & errors-to-avoid.
2. `catalog.js` with schema + launch data.
3. `index.html` shell: crayon styling, picker UI, scoring engine, card render, SVG covers.
4. AI mode: proxy call, streaming, domain-tuned prompt, off-catalog "도전" picks.
5. PWA files (manifest, icon, sw).
6. Repo contract: works-index row, count bump, thumbnail, README, CATALOG.md.
7. Verify deploy (curl 200) + spot-check render.
