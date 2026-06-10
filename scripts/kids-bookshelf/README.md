# kids-bookshelf — catalog build pipeline

Offline tooling that grows the `kids-bookshelf` book catalog (`kids-bookshelf/catalog.js`)
from a small hand-verified seed (88 books) toward ~300-500 entries, **without fabricating
titles**. Fabrication is the #1 risk — it bit the original 88-book pass (6 miscredited/invented
Korean titles were caught in review) — so the whole pipeline is built around auditable,
documented source lists and a "leave it out when unsure" rule.

## Sources

The raw, human-auditable input lives in `sources/`. These are **seed title lists only** —
minimal real-fact rows (title + author, plus ISBN-13 for English where confidently known).
A later enrichment step turns each row into a full catalog record (age band, tags, themes,
cover, etc.). The source files do NOT carry that derived metadata.

### `sources/en-canon.json`

Real English-language picture books drawn from **documented canon**, not memory-invented lists:

- **Caldecott Medal + Honor** winners
- **Kate Greenaway Medal** winners
- Author/illustrator backlists: Eric Carle, Julia Donaldson & Axel Scheffler, Mo Willems,
  Oliver Jeffers, Maurice Sendak, Janet & Allan Ahlberg, Dr. Seuss, Beatrix Potter,
  Sandra Boynton, Jon Klassen, Rosemary Wells, Kevin Henkes, Lois Ehlert, Don & Audrey Wood,
  Margaret Wise Brown, Bill Martin Jr., Leo Lionni, Ezra Jack Keats, Chris Van Allsburg,
  Peggy Rathmann, Arnold Lobel, William Steig, Robert McCloskey, and similar.

Row shape:

```json
{ "title": "Where the Wild Things Are", "author": "Maurice Sendak", "isbn": "9780064431781" }
```

- `isbn` is an **ISBN-13** and is present **only where a real edition's ISBN is confidently
  known**. If unsure, the field is **omitted entirely** — a missing ISBN just means no
  real-cover lookup happens later, which is fine. **ISBNs are never invented.**
- Spread across age bands (board books through early readers).

### `sources/ko-canon.json`

Real Korean 그림책 drawn from documented canon:

- **어린이도서연구회 권장도서**
- **세종도서 문학나눔** 선정작
- Author backlists: 백희나, 권정생, 이수지, 안녕달, 이억배, 채인선, 최숙희, 고대영,
  이지은, 권문희, 이영경, 서현, and similar — plus well-loved **Korean editions of global
  classics**, credited to the **original author** (존 버닝햄, 윌리엄 스타이그, 앤서니 브라운,
  레오 리오니, 모리스 샌닥, 고미 타로, 하야시 아키코, 사노 요코, 요시타케 신스케 …),
  **not the translator**, with the Korean **publisher**.

Row shape:

```json
{ "title": "구름빵", "author": "백희나", "publisher": "한솔수북" }
```

- Korean rows carry **no `isbn` field**.
- Only titles ≥90% certain to be real with the correct **author + publisher** are included.
  When unsure, the title is **left out**. A smaller all-real list is far better than a padded
  one — the list is deliberately not stretched to hit a target number.

## The rule

**Real titles only. No invented ISBNs. Omit when unsure.** Both source lists are
de-duplicated by title. The lists are **append-only seeds** — the build merges them with the
existing verified catalog and dedupes, so adding a new real title is always safe; the existing
88 human-verified entries are seeded in first and never dropped.

## Build (scripts added in a later task — documented here for intent)

The build runs in two phases from the repo root:

```bash
# 1. Enrich: take the source rows, resolve missing facts (age band, tags, themes, cover
#    lookups by ISBN, etc.) into an enriched intermediate. Network/cache step.
node scripts/kids-bookshelf/build-catalog.mjs

# 2. Emit: merge the enriched rows with the existing verified catalog, dedupe, and
#    regenerate kids-bookshelf/catalog.js in place.
node scripts/kids-bookshelf/build-catalog.mjs emit
```

`build-catalog.mjs` does not exist yet — it is added in a later task. This README documents
the intended flow so the source files have context. The source lists in `sources/` are the
stable, reviewable input that the build consumes.
