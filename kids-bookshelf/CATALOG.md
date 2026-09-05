# 책친구 catalog — append guide

`catalog.js` is the **single data spine** for the kids-bookshelf demo. Scoring, card
rendering, and the AI prompt all read `window.BOOKS` at runtime. To add a book you
only touch this one array — nothing downstream needs editing.

The list is **append-only**. Never reuse or renumber an `id`. A book you remove leaves
its `id` retired forever (so saved/shared state never points at the wrong title).

## Schema

Every field is required except `titleRoman` and `isbn`.

| field        | type                  | notes |
|--------------|-----------------------|-------|
| `id`         | string                | stable kebab slug, globally unique, NEVER reused. The original hand-typed Korean entries use a `kr-` prefix (e.g. `kr-gureumppang`) and are kept as-is; **new Korean ids use `ko-`** (the build emits `ko-<slug>-<hash>`), English use `en-` (e.g. `en-gruffalo`). Both prefixes exist in the file — do not rename the old ones |
| `lang`       | `"ko"` \| `"en"`      | drives the 🇰🇷/🇬🇧 flag and cover behavior |
| `title`      | string                | canonical title in its own script (한글 for `ko`, English for `en`) |
| `titleRoman` | string? (optional)    | romanization / original English title — EN-reader reference only |
| `author`     | string                | in its own script |
| `publisher`  | string                | |
| `ages`       | string[]              | subset of `["0-2","3-4","5-6","7-9"]` |
| `level`      | enum                  | `보드북` \| `그림책` \| `책읽기` \| `초기챕터북` |
| `themes`     | string[]              | from `THEME_VOCAB` (see below) |
| `mood`       | string[]              | from `MOOD_VOCAB` |
| `blurb`      | string                | curated "왜 이 책일까요?" sentence — always 한국어, even for EN books |
| `readAloud`  | string                | one-line "함께 읽기 팁" — always 한국어 |
| `cover`      | `{emoji, palette[]}`  | SVG placeholder cover; `palette` is 2 hex colors |
| `isbn`       | string? (optional)    | ISBN-13. EN titles use it to swap in an Open Library cover; omit if unsure |
| `source`     | `"curated"` \| `"ai"` | launch data is `curated`; promoted AI suggestions are `ai` |
| `quality`    | number 0–1            | build-time prior — award winners / canonical classics score higher. Used as a small ranking nudge so strong titles surface first on ties. Present on **all generated entries** (the build pipeline assigns it; hand-appended books may omit it and fall back to the neutral default **0.7** — the same value in both `build-catalog.mjs` and `app.js`). |

### Controlled vocabularies

**Source of truth is `scripts/kids-bookshelf/build-catalog.mjs`** (`THEME_VOCAB`, `MOOD_VOCAB`,
`AGES`, `LEVELS`); `emit` writes the theme/mood arrays into `catalog.js` and refuses to run if
`catalog.js` has drifted from them. The picker chips read `window.THEME_VOCAB` / `MOOD_VOCAB`
at runtime, so they follow automatically. The lists below are a copy for reference:

```
THEME_VOCAB: 공룡 우주 동물 공주 자동차 탈것 그림그리기 잠자리 자연 음식 가족 친구 감정 일상 환상 모험 숫자/글자 유머
MOOD_VOCAB:  웃긴 따뜻한 모험 학습 잔잔한
```

> Note: `환상` and `모험` exist in **both** lists where it makes sense — but `환상` is a
> theme only (it is **not** a valid `mood`). `모험` is valid as both a theme and a mood.
> When in doubt, check membership against the two arrays above; the validator below
> rejects any off-vocab string.

## How to add a book (worked example)

Append one object to the `BOOKS` array. A complete Korean example:

```js
{
  id: "ko-ddalgi-mujigae",              // unique kebab slug; new ids use ko- / en- (legacy kr- ids stay)
  lang: "ko",
  title: "딸기 무지개",                  // 한글 canonical title
  author: "홍길동",                      // 한글
  publisher: "보림",
  ages: ["3-4","5-6"],                   // subset of the four bands
  level: "그림책",                       // one of the four levels
  themes: ["음식","자연","감정"],         // all from THEME_VOCAB
  mood: ["따뜻한","잔잔한"],              // all from MOOD_VOCAB
  blurb: "딸기밭에 뜬 무지개를 따라가는 아이의 하루를 담아 계절의 설렘을 느끼게 해요.",
  readAloud: "무지개 색을 손가락으로 짚으며 색 이름을 함께 말해 보세요.",
  cover: { emoji: "🍓", palette: ["#e8595e","#7fb069"] },  // emoji + 2 hex colors
  // isbn: "978...",                     // optional — only for verified editions
  source: "curated"
}
```

English books are identical in shape, with `lang: "en"`, an English `title`/`author`,
`blurb`/`readAloud` still written **in Korean** (the audience is a Korean parent), and an
`isbn` where a real edition can be verified (the card swaps the SVG for an Open Library
cover at `https://covers.openlibrary.org/b/isbn/<isbn>-M.jpg`). If you are not confident
an ISBN is real, **omit it** — a missing ISBN just keeps the SVG placeholder cover, which
is fine. Never fabricate an ISBN.

## Build pipeline (how the catalog is generated)

The bulk of the catalog is now generated, not hand-typed. The pipeline lives at
`scripts/kids-bookshelf/build-catalog.mjs` and runs in **two phases, build-time only**
(the deployed demo never calls a model):

1. **Enrich** — `node build-catalog.mjs`
   Reads the sourced title lists in `scripts/kids-bookshelf/sources/{en,ko}-canon.json`
   and enriches each title (themes, mood, blurb, readAloud, cover, `quality` prior, …)
   into `enriched.json` via the Bedrock proxy. This is the only step that touches a
   model, and it happens on your machine, not in the browser.

2. **Emit** — `node build-catalog.mjs emit`
   Verifies a sample of English ISBNs against Open Library (**the build fails** if any
   sampled ISBN doesn't resolve), sanitizes tags (drops anything off-vocab), merges the
   enriched entries with the existing hand-curated books (append-only — never reuses an
   `id`), and regenerates `catalog.js`. The model's `real`/`confidence` flags **never drop
   a title automatically** — emit prints the flagged titles and a human moves any confirmed
   fake into `scripts/kids-bookshelf/sources/blocklist.json` (`"blocked": ["<lang>|<title>"]`).

To grow the catalog, add titles to the `sources/{en,ko}-canon.json` lists and re-run both
phases. Hand-appending a single book directly to `catalog.js` (the worked example above)
still works and is fine for one-offs.

## Recommendation is deterministic & offline

Recommendations are computed entirely in the browser with **no runtime LLM**: a free-text
keyword→theme lexicon turns the parent's note into scoring signals, a weighted score ranks
every book, and a diversity pass spreads the final picks across themes/languages. The
optional **AI 맞춤 추천** layer only *polishes the wording* of books that have already been
chosen by the deterministic scorer, in one batched call for the whole set — it never does the
recommending. The picked profile is mirrored into the URL hash
(`#age=3-4&t=공룡,동물&m=웃긴&s=2&n=…`), so a copied link reproduces the exact same six books.

### `NOTE_LEXICON` (in `app.js`)

`NOTE_LEXICON` is the keyword→theme/mood map that turns the parent's free-text note into
scoring nudges — deterministic and offline. Each entry is:

```js
{ kw: ["공룡","dino","dinosaur"], theme:"공룡" }          // boosts a theme
{ kw: ["잠","bedtime","sleep"], theme:"잠자리", mood:"잔잔한" } // boosts theme + mood
{ kw: ["무서워","scary"], mood:"모험", dir:-1 }            // dir:-1 DOWNweights
```

To add a keyword, append one `{ kw:[...], theme?, mood?, dir? }` object: `theme`/`mood` must
be valid `THEME_VOCAB`/`MOOD_VOCAB` strings, and `dir:-1` flips the signal negative
(down-weights a theme/mood the parent wants to avoid). Omit `dir` for a normal positive nudge.
Matching rules for `kw`:

- **Korean keys** are case-insensitive substrings and must be **2+ syllables**. Single
  syllables are banned — `화` fires on 동**화**책, `별` on 특**별**한, `잠` on 잠깐 — so
  write the inflected forms you actually mean (`화나`, `별자리`, `잠들`).
- **Latin keys** match **whole words only** (`\b…\b`, case-insensitive) — `car` no longer
  matches s**car**y and `plane` no longer matches **plane**t. Add plurals explicitly (`cars`).

## Validate after editing

There is no test framework — this snippet **is** the test. From the repo root:

```bash
node -e '
  global.window = {};
  require("./kids-bookshelf/catalog.js");
  const B = window.BOOKS, T = new Set(window.THEME_VOCAB), M = new Set(window.MOOD_VOCAB);
  const bands = new Set(["0-2","3-4","5-6","7-9"]);
  const levels = new Set(["보드북","그림책","책읽기","초기챕터북"]);
  const ids = new Set(); let errs = [];
  for (const b of B) {
    if (ids.has(b.id)) errs.push("dup id "+b.id); ids.add(b.id);
    for (const f of ["id","lang","title","author","publisher","ages","level","themes","mood","blurb","readAloud","cover","source"])
      if (b[f]==null) errs.push(b.id+" missing "+f);
    if (!["ko","en"].includes(b.lang)) errs.push(b.id+" bad lang");
    if (!levels.has(b.level)) errs.push(b.id+" bad level "+b.level);
    (b.ages||[]).forEach(a=>{ if(!bands.has(a)) errs.push(b.id+" bad age "+a); });
    (b.themes||[]).forEach(t=>{ if(!T.has(t)) errs.push(b.id+" off-vocab theme "+t); });
    (b.mood||[]).forEach(m=>{ if(!M.has(m)) errs.push(b.id+" off-vocab mood "+m); });
    if (!b.cover || !b.cover.emoji || !Array.isArray(b.cover.palette)) errs.push(b.id+" bad cover");
  }
  const ko = B.filter(b=>b.lang==="ko").length, en = B.filter(b=>b.lang==="en").length;
  console.log("total:",B.length,"ko:",ko,"en:",en);
  if (errs.length) { console.error("ERRORS:\n"+errs.join("\n")); process.exit(1); }
  console.log("catalog OK");
'
```

Expect `catalog OK`. Fix any reported id/field/vocabulary error and re-run until clean.
(The 한글 in the snippet is fine — Node handles UTF-8.)
