# 책친구 Scale + Lean Recommender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the kids-bookshelf catalog from 88 to ~300–500 real, verified books (via an offline build-time pipeline) and replace the crude runtime scorer with a strong deterministic engine (free-text keyword→theme lexicon, weighted features, a build-time quality prior, and a diversity pass) — with NO runtime LLM for recommendations.

**Architecture:** Two workstreams. (1) Build-time: a Node pipeline in `scripts/` sources real titles from finite known lists, enriches each with an offline LLM pass (via the existing Bedrock proxy — build-time only, NOT a runtime rec), assigns a `quality` prior, verifies a sample against Open Library/Aladin, and regenerates the static `kids-bookshelf/catalog.js` in the existing append-only shape. (2) Runtime: rewrite `scoreBook` + the selection in `recommend2` (in `kids-bookshelf/app.js`) to be deterministic, instant, offline — a keyword lexicon maps the parent's free text to themes/moods, weighted features + a quality nudge rank books, and an MMR-style diversity pass ensures the 6 results span different themes (no more 6 near-identical dino books) while keeping the 3 KR + 3 EN balance.

**Tech Stack:** Node 24 (built-in `fetch`, `crypto`) for the build scripts; plain browser JS for the runtime engine. No new browser dependencies. The Bedrock proxy at `https://ai.pb.gurum.se` is used ONLY at build time for enrichment. Catalog stays a single static `catalog.js`.

**Reference points (read before starting):**
- Current scorer: `kids-bookshelf/app.js` `scoreBook(b,p)`, `recommend2(p,varied)`, `pickVaried(sortedPool,n,poolSize)`, `let shuffleSalt`.
- Catalog shape + schema header: `kids-bookshelf/catalog.js` (globals `window.BOOKS`, `window.THEME_VOCAB`, `window.MOOD_VOCAB`) and `kids-bookshelf/CATALOG.md`.
- Proxy PoW + tool_use call pattern: `kids-bookshelf/app.js` `solveProxyPoW()` and `aiBlurbForBook()`; the node-side PoW (crypto SHA-256 over `nonce:counter`) appears throughout this session's tests — Task 2 includes it in full.
- Controlled vocab (MUST stay in sync): THEME_VOCAB = 공룡 우주 동물 공주 자동차 탈것 그림그리기 잠자리 자연 음식 가족 친구 감정 일상 환상 모험 숫자/글자 유머 ; MOOD_VOCAB = 웃긴 따뜻한 모험 학습 잔잔한 ; ages = 0-2 3-4 5-6 7-9 ; levels = 보드북 그림책 책읽기 초기챕터북.

**Verification reality:** No test framework in repo. Verify JS with `node --check`, catalog integrity with a node validator (extends the existing one with a `quality` check), engine behavior with node smoke harnesses that extract the real functions, and rendering with the cached Playwright/chromium driver (`/home/ubuntu/.hermes/hermes-agent/node_modules/playwright`, `['--no-sandbox']`, serve via `python3 -m http.server`). Deploy check = curl 200.

**Scope flag:** Sourcing 300–500 real books with correct Korean metadata is the hard, fabrication-prone part (it bit the original 88-book pass). Tasks 1–3 constrain sourcing to finite real lists, verify a sample, and drop low-confidence entries; a human review gate (Task 3 Step 6) precedes shipping. The catalog may land under 500 after drops — that is acceptable (real over count).

---

## Task 1: Build-script scaffold + sourced title lists

**Files:**
- Create: `scripts/kids-bookshelf/sources/en-canon.json`
- Create: `scripts/kids-bookshelf/sources/ko-canon.json`
- Create: `scripts/kids-bookshelf/README.md`

This task produces the raw, auditable title lists the enrichment reads. Sourcing is deliberately separated from enrichment so it is re-runnable and reviewable. The lists hold ONLY real, well-known titles — gathered from finite canon lists, not free invention.

- [ ] **Step 1: Create `scripts/kids-bookshelf/sources/en-canon.json`**

A JSON array of real English picture books drawn from documented canon: Caldecott Medal + Honor winners, Kate Greenaway Medal winners, and the backlists of Eric Carle / Julia Donaldson & Axel Scheffler / Mo Willems / Oliver Jeffers / Maurice Sendak / the Ahlbergs / Dr. Seuss / Beatrix Potter / Sandra Boynton / Jon Klassen / Rosemary Wells / Kevin Henkes. Each entry is the MINIMAL real-fact seed (the enrichment fills tags/blurb later):

```json
[
  { "title": "Where the Wild Things Are", "author": "Maurice Sendak", "isbn": "9780064431781" },
  { "title": "The Very Hungry Caterpillar", "author": "Eric Carle", "isbn": "9780399226908" },
  { "title": "The Gruffalo", "author": "Julia Donaldson", "isbn": "9780333710937" }
]
```

Aim for **~180–220 entries**. Include `isbn` (ISBN-13) where known; omit it if not confident (a missing ISBN just means no real-cover swap — fine). Do NOT invent ISBNs. Spread across age bands (board books → early readers). De-duplicate by title.

- [ ] **Step 2: Create `scripts/kids-bookshelf/sources/ko-canon.json`**

A JSON array of real Korean 그림책 from documented canon: 어린이도서연구회 권장도서, 세종도서 문학나눔 선정작, and the backlists of 백희나 / 권정생 / 이수지 / 안녕달 / 이억배 / 채인선 / 최숙희 / 고대영·김영진 / 이지은 / 권윤덕 / 김희경 / 류재수 / 정순희 / 윤여림, plus well-loved Korean editions of global classics (credit the original author). Each entry:

```json
[
  { "title": "구름빵", "author": "백희나", "publisher": "한솔수북" },
  { "title": "강아지똥", "author": "권정생", "publisher": "길벗어린이" }
]
```

Aim for **~140–180 entries**. KR entries carry NO isbn (Aladin coverage is patchy; SVG placeholder is the intended look). De-duplicate. **Only titles you are ≥90% sure are real** — when unsure, leave it out. (The original 88-book catalog already contains ~44 verified KR + ~44 EN titles; you may seed these lists from `kids-bookshelf/catalog.js` to guarantee the known-good ones are included, then expand.)

- [ ] **Step 3: Create `scripts/kids-bookshelf/README.md`**

Document: what each sources file is, where the titles come from (the canon lists above), the rule "real titles only, no invented ISBNs", and how to run the build (`node scripts/kids-bookshelf/build-catalog.mjs`, added in Task 2). Note the lists are append-only seeds and the build merges + dedupes with the existing catalog.

- [ ] **Step 4: Validate the source files are well-formed JSON with no dup titles**

```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
  const en=require("./scripts/kids-bookshelf/sources/en-canon.json");
  const ko=require("./scripts/kids-bookshelf/sources/ko-canon.json");
  const dup=(a)=>{const s=new Set(),d=[];for(const x of a){const k=x.title.trim();if(s.has(k))d.push(k);s.add(k);}return d;};
  console.log("en:",en.length,"ko:",ko.length);
  const de=dup(en),dk=dup(ko);
  if(de.length||dk.length){console.error("DUPS en:",de,"ko:",dk);process.exit(1);}
  for(const x of [...en,...ko]) if(!x.title||!x.author){console.error("missing title/author:",JSON.stringify(x));process.exit(1);}
  console.log("sources OK");
'
```
Expected: `sources OK`, en ≈ 180–220, ko ≈ 140–180.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add scripts/kids-bookshelf/sources/ scripts/kids-bookshelf/README.md
git commit -m "kids-bookshelf: sourced real-title canon lists for catalog expansion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Enrichment pipeline (offline LLM tagging)

**Files:**
- Create: `scripts/kids-bookshelf/build-catalog.mjs`

This is build-time only. It reads the source lists, asks the LLM (via the Bedrock proxy, using tool_use for structured output) to tag each book, and writes an intermediate `scripts/kids-bookshelf/enriched.json`. Verification + final catalog emission is Task 3.

- [ ] **Step 1: Write the proxy client + PoW solver in `build-catalog.mjs`**

```js
// scripts/kids-bookshelf/build-catalog.mjs — OFFLINE build tool. Not shipped to the browser.
// Sources real titles, enriches tags/blurb via the Bedrock proxy (BUILD-TIME ONLY), emits catalog.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PROXY = "https://ai.pb.gurum.se";
const ORIGIN = "https://kalleeh.github.io"; // proxy allows this origin
const HERE = path.dirname(new URL(import.meta.url).pathname);

async function solvePoW(){
  const r = await fetch(PROXY + "/api/claude-challenge", { headers: { Origin: ORIGIN } });
  if(!r.ok) throw new Error("challenge " + r.status);
  const { nonce, exp, sig, difficulty } = await r.json();
  const lead = (buf)=>{ let n=0; for(const x of buf){ if(x===0){n+=8;continue;} let v=x,c=0; while((v&0x80)===0){c++;v<<=1;} n+=c; break; } return n; };
  for(let c=0;;c++){ const d=crypto.createHash("sha256").update(nonce+":"+c).digest();
    if(lead(d)>=difficulty) return { "X-PoW-Nonce":nonce,"X-PoW-Exp":exp,"X-PoW-Sig":sig,"X-PoW-Counter":String(c) }; }
}
```

- [ ] **Step 2: Define the enrichment tool schema + a single-book enrich call**

```js
const THEME_VOCAB = ["공룡","우주","동물","공주","자동차","탈것","그림그리기","잠자리","자연","음식","가족","친구","감정","일상","환상","모험","숫자/글자","유머"];
const MOOD_VOCAB  = ["웃긴","따뜻한","모험","학습","잔잔한"];
const AGES = ["0-2","3-4","5-6","7-9"];
const LEVELS = ["보드북","그림책","책읽기","초기챕터북"];

const ENRICH_TOOL = {
  name: "tag_book",
  description: "어린이 그림책 한 권에 메타데이터 태그와 한국어 소개를 단다.",
  input_schema: {
    type: "object",
    properties: {
      real: { type: "boolean", description: "이 책이 실제로 존재하는 책이면 true. 확실하지 않으면 false." },
      confidence: { type: "number", description: "이 책이 실존한다고 확신하는 정도 0-1" },
      ages: { type: "array", items: { type: "string", enum: AGES } },
      level: { type: "string", enum: LEVELS },
      themes: { type: "array", items: { type: "string", enum: THEME_VOCAB }, description: "2-4개, 첫 번째가 핵심 테마" },
      mood: { type: "array", items: { type: "string", enum: MOOD_VOCAB }, description: "1-2개" },
      blurb: { type: "string", description: "왜 이 책일까요? 한국어 1-2문장" },
      readAloud: { type: "string", description: "함께 읽기 팁, 한국어 한 줄" },
      coverEmoji: { type: "string", description: "이 책을 대표하는 이모지 하나" },
      palette: { type: "array", items: { type: "string" }, description: "표지 색 2개, hex" },
      quality: { type: "number", description: "수상작/고전/스테디셀러일수록 1에 가깝게, 0-1" }
    },
    required: ["real","confidence","ages","level","themes","mood","blurb","readAloud","coverEmoji","palette","quality"]
  }
};

async function enrichOne(seed, lang){
  const sys = `너는 한국 어린이도서관의 그림책 큐레이터다. 주어진 실제 그림책 한 권에 대해 태그와 한국어 소개를 tag_book 도구로 단다.
규칙: 존재하지 않는 책이면 real=false로 표시하고 지어내지 마라. themes/mood는 주어진 어휘에서만 고른다. 환상은 mood가 아니라 theme다. blurb/readAloud는 영어책이라도 한국어로 쓴다.`;
  const user = `책: 제목 "${seed.title}", 글 ${seed.author}${seed.publisher?`, 출판사 ${seed.publisher}`:""}, 언어 ${lang}. 이 책의 태그를 tag_book 도구로 달아줘.`;
  const pow = await solvePoW();
  const res = await fetch(PROXY + "/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json", ...pow },
    body: JSON.stringify({ model:"sonnet", max_tokens:1200, system:sys,
      messages:[{ role:"user", content:user }], tools:[ENRICH_TOOL], tool_choice:{ type:"tool", name:"tag_book" } })
  });
  if(!res.ok) throw new Error("proxy " + res.status);
  const j = await res.json();
  const tu = (j.content||[]).find(b=>b.type==="tool_use" && b.name==="tag_book");
  if(!tu||!tu.input) throw new Error("no tool_use");
  return tu.input;
}
```

- [ ] **Step 3: Add the slug helper + the main enrichment loop (concurrency-limited, resumable)**

```js
function slug(lang, title){
  // stable kebab id; transliterate spaces/punct out, keep it unique-ish with a short hash
  const base = title.toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,"").slice(0,32);
  const h = crypto.createHash("sha1").update(lang+":"+title).digest("hex").slice(0,4);
  return `${lang}-${base||"book"}-${h}`;
}

async function pool(items, limit, worker){
  let i=0; const out=new Array(items.length);
  const runners=Array.from({length:Math.min(limit,items.length)}, async ()=>{
    while(i<items.length){ const idx=i++; try{ out[idx]=await worker(items[idx],idx); }catch(e){ out[idx]={__error:e.message}; } }
  });
  await Promise.all(runners); return out;
}

async function main(){
  const en = JSON.parse(fs.readFileSync(path.join(HERE,"sources/en-canon.json"),"utf8")).map(s=>({...s,lang:"en"}));
  const ko = JSON.parse(fs.readFileSync(path.join(HERE,"sources/ko-canon.json"),"utf8")).map(s=>({...s,lang:"ko"}));
  const seeds = [...ko, ...en];
  // resumable: skip seeds already in enriched.json
  const outPath = path.join(HERE,"enriched.json");
  const done = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath,"utf8")) : [];
  const doneTitles = new Set(done.map(d=>d.lang+"|"+d.title));
  const todo = seeds.filter(s=>!doneTitles.has(s.lang+"|"+s.title));
  console.log(`enriching ${todo.length} of ${seeds.length} (${done.length} already done)`);

  const results = await pool(todo, 4, async (seed)=>{
    const tags = await enrichOne(seed, seed.lang);
    return { seed, tags };
  });

  for(const r of results){
    if(!r || r.__error){ console.warn("FAIL:", r&&r.__error); continue; }
    const { seed, tags } = r;
    done.push({
      id: slug(seed.lang, seed.title), lang: seed.lang, title: seed.title, author: seed.author,
      publisher: seed.publisher || "", isbn: seed.isbn || undefined,
      ages: tags.ages, level: tags.level, themes: tags.themes, mood: tags.mood,
      blurb: tags.blurb, readAloud: tags.readAloud,
      cover: { emoji: tags.coverEmoji, palette: tags.palette },
      quality: Math.max(0, Math.min(1, Number(tags.quality)||0.5)),
      real: tags.real, confidence: tags.confidence, source: "curated"
    });
  }
  fs.writeFileSync(outPath, JSON.stringify(done,null,1));
  console.log(`wrote ${done.length} enriched entries → ${outPath}`);
}
main().catch(e=>{ console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run the enrichment (live, network-dependent — build-time)**

```bash
cd /home/ubuntu/projects/vibe-demos
node scripts/kids-bookshelf/build-catalog.mjs
```
Expected: it prints progress and writes `scripts/kids-bookshelf/enriched.json` with one object per sourced title. It is resumable — re-run if it dies partway (already-done titles are skipped). If the proxy rate-limits (429), the concurrency of 4 + the daily cap should keep it under limits; if you hit the daily cap, resume the next run. Confirm the file exists and has roughly (en+ko) entries:
```bash
node -e 'const a=require("./scripts/kids-bookshelf/enriched.json");console.log("enriched:",a.length,"| real=true:",a.filter(x=>x.real).length)'
```

- [ ] **Step 5: Commit (the script + the enriched intermediate)**

```bash
cd /home/ubuntu/projects/vibe-demos
git add scripts/kids-bookshelf/build-catalog.mjs scripts/kids-bookshelf/enriched.json
git commit -m "kids-bookshelf: offline enrichment pipeline + enriched intermediate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Verify, merge, and emit the new `catalog.js`

**Files:**
- Modify: `scripts/kids-bookshelf/build-catalog.mjs` (add an `emit` step / second entry point)
- Modify: `kids-bookshelf/catalog.js` (regenerated)

- [ ] **Step 1: Add a sampled verification pass to the build script**

Add a function that checks a sample of enriched entries against Open Library (EN, by ISBN) and drops entries flagged `real:false` or `confidence < 0.6`. Append to `build-catalog.mjs` (guard `main()` so this runs under `node build-catalog.mjs emit`):

```js
async function verifySampleEN(entries, sampleSize){
  const en = entries.filter(e=>e.lang==="en" && e.isbn);
  // deterministic sample: every Nth
  const step = Math.max(1, Math.floor(en.length / sampleSize));
  const sample = en.filter((_,i)=> i % step === 0).slice(0, sampleSize);
  let ok=0, bad=[];
  for(const e of sample){
    try{
      const r = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(e.isbn)}.json`);
      if(r.ok) ok++; else bad.push(e.title+" ("+e.isbn+") → "+r.status);
    }catch(err){ bad.push(e.title+" → "+err.message); }
  }
  console.log(`OL sample check: ${ok}/${sample.length} resolved`);
  if(bad.length) console.warn("unresolved sample:\n  "+bad.join("\n  "));
  return { ok, total: sample.length, bad };
}
```

- [ ] **Step 2: Add the merge + emit logic**

Merge the enriched entries with the existing known-good catalog, dedupe by (lang,title), drop low-confidence/`real:false`, and write `kids-bookshelf/catalog.js` in the exact existing shape. Append to the script (under the `emit` branch):

```js
function emitCatalog(){
  const enriched = JSON.parse(fs.readFileSync(path.join(HERE,"enriched.json"),"utf8"));
  // existing known-good catalog (already human-verified in prior review)
  globalThis.window = {};
  // load the current catalog.js to preserve its 88 verified books
  const cur = fs.readFileSync(path.join(HERE,"../../kids-bookshelf/catalog.js"),"utf8");
  eval(cur.replace(/^window\./gm,"globalThis.window.")); // populates window.BOOKS etc.
  const existing = (globalThis.window.BOOKS||[]).map(b=>({ ...b, quality: b.quality ?? 0.7 }));

  // keep enriched entries that are real + confident
  const kept = enriched.filter(e => e.real !== false && (e.confidence==null || e.confidence >= 0.6));

  // merge: existing first (verified), then enriched not already present by (lang|title)
  const seen = new Set(existing.map(b=>b.lang+"|"+b.title));
  const merged = [...existing];
  for(const e of kept){
    const k = e.lang+"|"+e.title;
    if(seen.has(k)) continue; seen.add(k);
    merged.push({
      id: e.id, lang: e.lang, title: e.title, author: e.author, publisher: e.publisher,
      ...(e.isbn?{isbn:e.isbn}:{}), ages: e.ages, level: e.level, themes: e.themes, mood: e.mood,
      blurb: e.blurb, readAloud: e.readAloud, cover: e.cover, quality: e.quality, source: "curated"
    });
  }
  // dedupe ids defensively
  const byId = new Set(); const final = [];
  for(const b of merged){ if(byId.has(b.id)) continue; byId.add(b.id); final.push(b); }

  const header = `/* 책친구 catalog — append-only book data. See CATALOG.md for the schema.
 * Generated/expanded by scripts/kids-bookshelf/build-catalog.mjs.
 * Every field except titleRoman/isbn is required. New: quality (0-1) build-time prior. */\n`;
  const body = `window.THEME_VOCAB = ${JSON.stringify(THEME_VOCAB)};\n`
    + `window.MOOD_VOCAB  = ${JSON.stringify(MOOD_VOCAB)};\n`
    + `window.BOOKS = ${JSON.stringify(final, null, 1)};\n`;
  fs.writeFileSync(path.join(HERE,"../../kids-bookshelf/catalog.js"), header + body);
  const ko=final.filter(b=>b.lang==="ko").length, en=final.filter(b=>b.lang==="en").length;
  console.log(`emitted catalog.js: ${final.length} books (ko ${ko}, en ${en})`);
}

// entry-point switch at the very bottom of the file:
if (process.argv[2] === "emit") { await verifySampleEN(JSON.parse(fs.readFileSync(path.join(HERE,"enriched.json"),"utf8")), 25); emitCatalog(); }
else { await main(); }
```
(Replace the existing bare `main().catch(...)` call at the bottom with this switch. Keep the `.catch` behavior by wrapping in a top-level try or `process.on("unhandledRejection")`.)

- [ ] **Step 3: Run emit**

```bash
cd /home/ubuntu/projects/vibe-demos
node scripts/kids-bookshelf/build-catalog.mjs emit
```
Expected: prints the OL sample check ratio and `emitted catalog.js: N books (ko …, en …)` with N in the ~250–500 range.

- [ ] **Step 4: Run the catalog validator (extended with quality)**

```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
  global.window = {};
  require("./kids-bookshelf/catalog.js");
  const B=window.BOOKS, T=new Set(window.THEME_VOCAB), M=new Set(window.MOOD_VOCAB);
  const bands=new Set(["0-2","3-4","5-6","7-9"]), levels=new Set(["보드북","그림책","책읽기","초기챕터북"]);
  const ids=new Set(); let errs=[];
  for(const b of B){
    if(ids.has(b.id)) errs.push("dup id "+b.id); ids.add(b.id);
    for(const f of ["id","lang","title","author","publisher","ages","level","themes","mood","blurb","readAloud","cover","source"]) if(b[f]==null) errs.push(b.id+" missing "+f);
    if(typeof b.quality!=="number"||b.quality<0||b.quality>1) errs.push(b.id+" bad quality");
    if(!["ko","en"].includes(b.lang)) errs.push(b.id+" bad lang");
    if(!levels.has(b.level)) errs.push(b.id+" bad level "+b.level);
    (b.ages||[]).forEach(a=>{if(!bands.has(a))errs.push(b.id+" bad age "+a);});
    (b.themes||[]).forEach(t=>{if(!T.has(t))errs.push(b.id+" off-vocab theme "+t);});
    (b.mood||[]).forEach(m=>{if(!M.has(m))errs.push(b.id+" off-vocab mood "+m);});
    if(!b.cover||!b.cover.emoji||!Array.isArray(b.cover.palette)) errs.push(b.id+" bad cover");
  }
  console.log("total:",B.length,"ko:",B.filter(b=>b.lang==="ko").length,"en:",B.filter(b=>b.lang==="en").length);
  if(errs.length){ console.error("ERRORS ("+errs.length+"):\n"+errs.slice(0,40).join("\n")); process.exit(1); }
  console.log("catalog OK");
'
```
Expected: `catalog OK`, total in the ~250–500 range, both pools well-populated. Fix any off-vocab/missing-field errors by adjusting the emit mapping and re-running emit.

- [ ] **Step 5: Spot-check ~15-20 titles for fabrication (human review gate)**

Print a random-ish sample and eyeball that they are real books with correct author:
```bash
cd /home/ubuntu/projects/vibe-demos
node -e 'global.window={};require("./kids-bookshelf/catalog.js");const B=window.BOOKS;const step=Math.floor(B.length/18);for(let i=0;i<B.length;i+=step){const b=B[i];console.log(`${b.lang} | ${b.title} — ${b.author} ${b.publisher?"("+b.publisher+")":""}`);}'
```
Review the output. If any title looks invented or miscredited, remove it from the source list (Task 1) or add it to a drop-list and re-run. **Report the confidence level honestly** — do not claim all-verified. This is the same discipline that caught fabrications in the original 88-book pass.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add scripts/kids-bookshelf/build-catalog.mjs kids-bookshelf/catalog.js
git commit -m "kids-bookshelf: expand catalog to ~NNN books (verified sample + quality prior)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
(Replace NNN with the actual count.)

---

## Task 4: Free-text keyword→theme/mood lexicon

**Files:**
- Modify: `kids-bookshelf/app.js`

- [ ] **Step 1: Add the lexicon + a mapper function**

Add near the top of `app.js` (after the emoji/icon maps). The lexicon maps Korean/English keywords a parent might type to theme/mood signals. `dir` is +1 to boost, -1 to downweight.

```js
// Free-text → signal lexicon. Maps words a parent types in the note to theme/mood nudges.
// Deterministic, offline — this is how the note steers recs without any model.
const NOTE_LEXICON = [
  { kw: ["공룡","티라노","브라키오","다이노","dino","dinosaur"], theme:"공룡" },
  { kw: ["우주","로켓","행성","별","space","rocket","planet"], theme:"우주" },
  { kw: ["동물","강아지","고양이","토끼","곰","사자","animal","puppy","cat"], theme:"동물" },
  { kw: ["공주","왕자","드레스","princess"], theme:"공주" },
  { kw: ["자동차","차","부릉","car"], theme:"자동차" },
  { kw: ["기차","버스","비행기","탈것","train","bus","plane"], theme:"탈것" },
  { kw: ["그림","색칠","크레용","draw","paint","color"], theme:"그림그리기" },
  { kw: ["잠","자기 전","잠들기","재우","잠자리","bedtime","sleep"], theme:"잠자리", mood:"잔잔한" },
  { kw: ["자연","숲","나무","꽃","바다","nature","forest"], theme:"자연" },
  { kw: ["음식","먹","요리","빵","과자","food","eat"], theme:"음식" },
  { kw: ["가족","엄마","아빠","할머니","형제","family"], theme:"가족" },
  { kw: ["친구","우정","friend"], theme:"친구" },
  { kw: ["감정","마음","화","슬픔","무서","feeling","emotion"], theme:"감정" },
  { kw: ["모험","탐험","여행","adventure","explore"], theme:"모험", mood:"모험" },
  { kw: ["숫자","글자","한글","abc","number","letter","알파벳"], theme:"숫자/글자", mood:"학습" },
  { kw: ["웃긴","까르르","웃겨","재밌","funny","laugh"], theme:"유머", mood:"웃긴" },
  { kw: ["따뜻","포근","사랑","warm","cozy"], mood:"따뜻한" },
  { kw: ["배우","공부","교육","learn","educational"], mood:"학습" },
  { kw: ["무서워","무서운","scary","afraid"], mood:"모험", dir:-1 }, // downweight scary/adventure
];

// Returns {themes:{theme:weight}, moods:{mood:weight}} derived from the note text.
function lexiconSignals(note){
  const out = { themes:{}, moods:{} };
  if(!note) return out;
  const n = note.toLowerCase();
  for(const e of NOTE_LEXICON){
    if(e.kw.some(k => n.includes(k.toLowerCase()))){
      const w = (e.dir===-1) ? -1 : 1;
      if(e.theme) out.themes[e.theme] = (out.themes[e.theme]||0) + w;
      if(e.mood)  out.moods[e.mood]   = (out.moods[e.mood]||0) + w;
    }
  }
  return out;
}
```

- [ ] **Step 2: Syntax check + unit smoke for the mapper**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
node -e '
  const src=require("fs").readFileSync("kids-bookshelf/app.js","utf8");
  eval(src.match(/const NOTE_LEXICON[\s\S]*?\n\];/)[0]);
  eval(src.match(/function lexiconSignals[\s\S]*?\n}/)[0]);
  const a=lexiconSignals("우리 애가 요즘 티라노에 빠졌어요");
  const b=lexiconSignals("잠들기 전에 읽어줄 잔잔한 책");
  const c=lexiconSignals("무서운 건 안 좋아해요");
  console.log("dino:",JSON.stringify(a.themes));   // expect 공룡:1
  console.log("bedtime:",JSON.stringify(b));        // expect themes 잠자리, moods 잔잔한
  console.log("scary:",JSON.stringify(c.moods));     // expect 모험:-1
  if(a.themes["공룡"]!==1||b.themes["잠자리"]!==1||b.moods["잔잔한"]!==1||c.moods["모험"]!==-1){console.error("lexicon FAIL");process.exit(1);}
  console.log("lexicon OK");
'
```
Expected: `app.js OK`, the three lines, `lexicon OK`.

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/app.js
git commit -m "kids-bookshelf: free-text keyword→theme/mood lexicon for the note box

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: New weighted `scoreBook` (features + quality prior + lexicon)

**Files:**
- Modify: `kids-bookshelf/app.js`

- [ ] **Step 1: Replace `scoreBook` with the weighted version**

Replace the entire current `scoreBook(b,p)` with:

```js
// Deterministic fit score. Higher = better. Uses age curve, weighted theme/mood match,
// the note lexicon, and a small build-time quality prior. No randomness here (reroll
// variety lives in pickVaried), except a tiny id tiebreak so equal scores order stably.
function scoreBook(b, p){
  let s = 0;
  // age: exact band best, adjacent soft, far penalized (soft gate, not hard)
  if (p.age){
    if (b.ages.includes(p.age)) s += 5;
    else {
      const order = ["0-2","3-4","5-6","7-9"];
      const pi = order.indexOf(p.age);
      const adj = b.ages.some(a => Math.abs(order.indexOf(a)-pi)===1);
      s += adj ? 1.5 : -4;
    }
  }
  // themes: primary (first listed) match weighted higher than secondary matches
  const picked = new Set(p.themes||[]);
  if (b.themes && b.themes.length){
    if (picked.has(b.themes[0])) s += 4;                 // primary theme hit
    for (let i=1;i<b.themes.length;i++) if(picked.has(b.themes[i])) s += 2; // secondary hits
  }
  // mood overlap
  s += (b.mood||[]).filter(m => (p.moods||[]).includes(m)).length * 2;
  // free-text lexicon signals (boost matched themes/moods, downweight negatives)
  const sig = lexiconSignals(p.note);
  for (const t of (b.themes||[])) if (sig.themes[t]) s += sig.themes[t] * 2.5;
  for (const m of (b.mood||[])) if (sig.moods[m]) s += sig.moods[m] * 1.5;
  // build-time quality prior: small nudge so classics surface (range ~0..1.2)
  s += (typeof b.quality === "number" ? b.quality : 0.5) * 1.2;
  // stable tiny tiebreak
  s += (b.id.charCodeAt(b.id.length-1) % 7) * 0.01;
  return s;
}
```

- [ ] **Step 2: Syntax check + scoring smoke (uses real catalog)**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
node -e '
  global.window={}; require("./kids-bookshelf/catalog.js");
  const src=require("fs").readFileSync("kids-bookshelf/app.js","utf8");
  eval(src.match(/const NOTE_LEXICON[\s\S]*?\n\];/)[0]);
  eval(src.match(/function lexiconSignals[\s\S]*?\n}/)[0]);
  eval(src.match(/function scoreBook[\s\S]*?\n}/)[0]);
  // a 공룡 note should rank a 공룡-primary book above a random unrelated one
  const dinoBook = window.BOOKS.find(b=>b.themes[0]==="공룡") || window.BOOKS.find(b=>b.themes.includes("공룡"));
  const other = window.BOOKS.find(b=>!b.themes.includes("공룡"));
  const p = {age:"3-4",gender:"상관없음",themes:["공룡"],moods:[],note:"티라노 좋아해요"};
  const sd = scoreBook(dinoBook,p), so = scoreBook(other,p);
  console.log("dino score:",sd.toFixed(2),"other:",so.toFixed(2));
  if(!(sd>so)){console.error("FAIL: dino book did not outrank");process.exit(1);}
  console.log("scoreBook OK");
'
```
Expected: `app.js OK`, the scores, `scoreBook OK` (dino book outranks).

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/app.js
git commit -m "kids-bookshelf: weighted scoreBook (primary/secondary theme, lexicon, quality prior)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Diversity pass in `recommend2`

**Files:**
- Modify: `kids-bookshelf/app.js`

The current `recommend2` takes the top 3 KR + top 3 EN by score. With a big catalog and a strong 공룡 signal, that can yield 6 near-identical dino books. Add an MMR-style diversity selection that still respects the 3+3 balance.

- [ ] **Step 1: Add a diversity selector helper**

Add above `recommend2`:

```js
// Greedy diversity pick: from a score-sorted pool, take up to n books while avoiding
// repeating the same PRIMARY theme until all distinct primaries are used. Keeps strong
// fits but spreads across themes so results aren't 6 near-identical books.
function pickDiverse(sortedPool, n){
  const out = [], usedPrimary = new Set();
  // first pass: highest-scoring book per distinct primary theme
  for (const x of sortedPool){
    if (out.length >= n) break;
    const prim = x.b.themes && x.b.themes[0];
    if (prim && usedPrimary.has(prim)) continue;
    out.push(x); if (prim) usedPrimary.add(prim);
  }
  // second pass: if still short (few distinct themes), backfill by score
  if (out.length < n){
    const have = new Set(out.map(x=>x.b.id));
    for (const x of sortedPool){ if(out.length>=n) break; if(!have.has(x.b.id)){ out.push(x); have.add(x.b.id);} }
  }
  return out.slice(0, n);
}
```

- [ ] **Step 2: Wire diversity into `recommend2`**

Replace the body of `recommend2` with (keeps `varied`/`pickVaried` for reroll, adds diversity to the non-varied path AND the varied path):

```js
function recommend2(p, varied){
  const scored = window.BOOKS
    .map(b => ({ b, s: scoreBook(b,p) }))
    .filter(x => x.s > -2)
    .sort((a,b) => b.s - a.s);
  const ko = scored.filter(x => x.b.lang==="ko");
  const en = scored.filter(x => x.b.lang==="en");
  let koPick, enPick;
  if (varied){
    // reroll: rotate a wider pool (variety), THEN diversify by theme
    koPick = pickDiverse(pickVaried(ko, 8, 16), 3);
    enPick = pickDiverse(pickVaried(en, 8, 16), 3);
  } else {
    // first search: diversify across the top of each pool
    koPick = pickDiverse(ko, 3);
    enPick = pickDiverse(en, 3);
  }
  let pick = [...koPick, ...enPick];
  if (pick.length < 6){
    const used = new Set(pick.map(x=>x.b.id));
    for (const x of scored){ if(pick.length>=6) break; if(!used.has(x.b.id)){ pick.push(x); used.add(x.b.id);} }
  }
  return pick.map(x => x.b);
}
```
Note: `pickVaried(ko, 8, 16)` now returns up to 8 varied candidates, which `pickDiverse(..., 3)` then narrows to 3 distinct-theme picks — so reroll stays lively AND diverse.

- [ ] **Step 3: Syntax check + diversity smoke**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
node -e '
  global.window={}; require("./kids-bookshelf/catalog.js");
  const src=require("fs").readFileSync("kids-bookshelf/app.js","utf8");
  let shuffleSalt=0;
  eval(src.match(/const NOTE_LEXICON[\s\S]*?\n\];/)[0]);
  eval(src.match(/function lexiconSignals[\s\S]*?\n}/)[0]);
  eval(src.match(/function scoreBook[\s\S]*?\n}/)[0]);
  eval(src.match(/function pickVaried[\s\S]*?\n}/)[0]);
  eval(src.match(/function pickDiverse[\s\S]*?\n}/)[0]);
  eval(src.match(/function recommend2[\s\S]*?\n}/)[0]);
  // strong single-theme signal should NOT yield 6 identical-primary books
  const p={age:"3-4",gender:"상관없음",themes:["공룡"],moods:[],note:"공룡 공룡 공룡"};
  const r=recommend2(p,false);
  const primaries=r.map(b=>b.themes[0]);
  const distinct=new Set(primaries).size;
  console.log("count:",r.length,"| primaries:",primaries.join(","),"| distinct:",distinct);
  if(r.length!==6){console.error("FAIL not 6");process.exit(1);}
  if(distinct<2){console.error("FAIL no diversity (all same primary)");process.exit(1);}
  // reroll changes the set
  shuffleSalt=1; const r2=recommend2(p,true);
  console.log("reroll distinct:",new Set(r2.map(b=>b.themes[0])).size, "| changed:", JSON.stringify(r.map(b=>b.id))!==JSON.stringify(r2.map(b=>b.id)));
  console.log("diversity OK");
'
```
Expected: `app.js OK`, count 6, distinct ≥ 2 (diversity working), reroll changes the set, `diversity OK`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/app.js
git commit -m "kids-bookshelf: MMR-style diversity pass so results span themes (no 6 dino books)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Docs, cache bump, works-index/README touch

**Files:**
- Modify: `kids-bookshelf/CATALOG.md`
- Modify: `kids-bookshelf/sw.js`
- Modify: `index.html` (works-index row description)
- Modify: `README.md`

- [ ] **Step 1: Update `kids-bookshelf/CATALOG.md`**

Document: the new `quality` field (0–1 build-time prior, optional but present on all generated entries), the `NOTE_LEXICON` (what it is, how to add a keyword), and the build pipeline (`scripts/kids-bookshelf/build-catalog.mjs`: `node build-catalog.mjs` to enrich, `node build-catalog.mjs emit` to regenerate `catalog.js`; sources in `scripts/kids-bookshelf/sources/`). Keep the existing schema table; add `quality` to it.

- [ ] **Step 2: Bump the SW cache**

In `kids-bookshelf/sw.js` change `const CACHE = "vibe-kids-bookshelf-v5";` to `"vibe-kids-bookshelf-v6";`.

- [ ] **Step 3: Update the works-index row description (optional light touch)**

In `index.html`, the kids-bookshelf `<a class="work">` row tags currently say "그림책 추천 · 한·영 / 나이·관심사 맞춤 / Curated + Claude AI". Leave the structure; optionally update if a tag references the old book count. (No count is shown in the row, so likely no change needed — verify and leave as-is if so.)

- [ ] **Step 4: Update `README.md`**

The kids-bookshelf bullet says "~90 titles". Update to the new count (e.g. "a hand-curated catalog of ~NNN titles") and note recommendations are deterministic/offline by default with an optional AI polish layer. Use the actual final count from Task 3.

- [ ] **Step 5: Verify counts are consistent**

```bash
cd /home/ubuntu/projects/vibe-demos
node -e 'global.window={};require("./kids-bookshelf/catalog.js");console.log("catalog:",window.BOOKS.length)'
grep -o 'vibe-kids-bookshelf-v[0-9]*' kids-bookshelf/sw.js
grep -c 'kids-bookshelf' README.md   # expect >=1
```

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/CATALOG.md kids-bookshelf/sw.js index.html README.md
git commit -m "kids-bookshelf: docs for quality prior + lexicon + build pipeline; cache v6; README count

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Integration check + deploy

**Files:** none (verification only)

- [ ] **Step 1: Headless render walkthrough (diversity + reroll + AI still works)**

Serve the repo (`python3 -m http.server PORT`) and drive `kids-bookshelf/` with the cached Playwright driver (`/home/ubuntu/.hermes/hermes-agent/node_modules/playwright`, `chromium.launch({args:['--no-sandbox']})`). Exercise:
- Pick age 3-4, theme 공룡, type "공룡 좋아해요" → click 책 찾아주세요! → confirm 6 cards render, and the set is NOT 6 identical-primary-theme books (count distinct primary themes via `page.evaluate`).
- Click 다시 추천 → confirm the set changes.
- Toggle AI on → confirm per-book progressive loading still fills cards (the AI layer is unchanged but must still work against the bigger catalog).
Report distinct-theme counts and whether AI cards filled. Be honest about what was/wasn't exercised (Korean glyphs may be tofu in sandbox chromium — verify via DOM textContent, not the screenshot).

- [ ] **Step 2: Push**

```bash
cd /home/ubuntu/projects/vibe-demos
git push origin main
```
(If on a feature branch per subagent-driven-development, merge to main first via finishing-a-development-branch, then push.)

- [ ] **Step 3: Deploy verification (wait ~45s)**

```bash
sleep 45
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/kids-bookshelf/            # 200
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/kids-bookshelf/catalog.js   # 200
curl -s https://kalleeh.github.io/vibe-demos/kids-bookshelf/catalog.js | grep -c 'quality'                # >0 (new field shipped)
```
Expected: 200, 200, and a positive grep count.

- [ ] **Step 4: Report**

Summarize: final catalog size (ko/en split), verification confidence (sample OL ratio + spot-check result), that the diversity pass is working (distinct themes in a single-signal search), reroll still varies, AI polish still works, and the live URLs return 200. Flag any caveats (titles dropped for low confidence, Korean cover placeholders by design).

---

## Self-Review notes

- **Spec coverage:** catalog 88→~300-500 via build pipeline (T1 sources, T2 enrich, T3 verify+merge+emit); `quality` prior (T2 schema, T3 emit, T5 scoring); source-constrained + sampled verification + review gate (T1 finite lists, T3 Steps 1/5); single static catalog.js preserved (T3 emit keeps shape); free-text lexicon (T4); weighted features primary/secondary + age curve + quality (T5); diversity pass (T6); CATALOG.md + cache + README (T7); verify + deploy (T8). No runtime LLM in the rec path — scoreBook/recommend2 are pure functions; the only network is the UNCHANGED optional AI-polish layer. All covered.
- **Type consistency:** `lexiconSignals(note)` returns `{themes:{},moods:{}}` used identically in T4 and T5. `scoreBook(b,p)` signature unchanged (callers in recommend2 unaffected). `pickDiverse(sortedPool,n)` and `pickVaried(sortedPool,n,poolSize)` both take score-sorted `[{b,s}]` arrays and return the same — composes in T6. Catalog adds `quality` (number 0-1); existing books get `quality:0.7` default in T3 emit so scoreBook's `b.quality` is always present. `window.BOOKS/THEME_VOCAB/MOOD_VOCAB` shape unchanged.
- **Placeholder scan:** "NNN" in T3/T7 commit messages and README is an intentional fill-in-the-actual-count, not a vague instruction — the count comes from T3 Step 3 output. No TBD/TODO in code steps; all code is complete.
- **Deviation note:** T3 Step 2 uses `eval` to load the existing `catalog.js` inside the build script to preserve the 88 verified books — acceptable for a build-time Node tool reading our own generated file (not runtime, not untrusted input).
