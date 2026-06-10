# 책친구 (Kids Book Recommender) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `kids-bookshelf/` — a Korean-language, crayon-picture-book kids' book recommender that takes a child profile (age/gender/interests/mood/free-text) and returns ~6 bilingual (🇰🇷+🇬🇧) real-book recommendations from a hand-curated, extensible catalog, with an optional AI personalization mode via the shared Bedrock proxy.

**Architecture:** A self-contained static demo: `index.html` (crayon UI + scoring engine + card render + SVG covers + AI call) reading a standalone, append-only `catalog.js` (flat array of plain-data book objects). Catalog mode (default, no key, instant) does rule-based scoring against the profile. AI mode is an optional single non-streaming call to `https://ai.pb.gurum.se/api/claude` (PoW-gated, no BYOK) that re-ranks/explains using the catalog as grounding and may add 1–2 off-catalog "도전" picks. Client-only — no backend.

**Tech Stack:** Plain HTML/CSS/vanilla JS (one classic `<script>` for the app + one `<script type="module">` only if needed — actually all classic, no imports needed since no SDK). SVG turbulence filters for the crayon/hand-drawn look. Open Library covers (`covers.openlibrary.org`) for English ISBNs, lazy-swapped over SVG placeholders. PWA shell (manifest/icon/sw). No build step.

**Reference implementations to crib from (read before starting):**
- AI proxy call + PoW: `changwon-homes/index.html` lines ~511–525 (`solveProxyPoW`) and ~883–895 (the `fetch(CLAUDE_PROXY + "/api/claude")` non-streaming call). Proxy returns native Claude JSON; **`stream:true` is rejected with 400** — do NOT stream.
- Domain-tuned system prompt: `intake-companion/index.html` `callClaude()`'s `sys` variable (XML-tagged structure).
- SW pattern: `changwon-homes/sw.js` (network-first HTML, cache-first assets, skip cross-origin).
- Manifest: `changwon-homes/manifest.webmanifest`. Icon grammar: `changwon-homes/icon.svg`.
- Works-index row grammar: `index.html` line ~683 (the changwon `<a class="work">` row).

**Verification reality:** This repo has no test framework. Verify JS syntax with `node --check <file>` (works for classic scripts and module bodies; it won't resolve bare imports but we have none). Verify catalog data integrity with a small throwaway `node` snippet. Render verification uses the cached Playwright/chromium driver noted in memory (`project_tinywings_playtest_driver`) — a headless screenshot — NOT a live browser the user must open. Deploy verification is `curl` for HTTP 200.

**Slug:** `kids-bookshelf`. **Works-index entry:** #11 (10 shipped; clean append, no placeholder rows exist).

---

## Task 1: Catalog research + `catalog.js` with launch data

**Files:**
- Create: `kids-bookshelf/catalog.js`
- Create: `kids-bookshelf/CATALOG.md`

This task front-loads the domain research pass (per CLAUDE.md's domain-tuned methodology) and produces the data spine everything else reads. Do the research FIRST, then write the file.

- [ ] **Step 1: Run the catalog research pass via a subagent**

Dispatch an `Explore` or `general-purpose` agent with this tight, audience-anchored brief (paste verbatim):

> Research real, widely-loved children's picture books for a Korean parent of a 0–9-year-old, to populate a bilingual book-recommender catalog. I need TWO pools:
>
> **Pool A — Korean 그림책 canon (~45 titles):** books a Korean parent / 어린이도서관 사서 would actually name. Include modern Korean classics (e.g. 백희나's 구름빵·달 샤베트·알사탕, 권정생 강아지똥, 이수지's 그림자놀이·파도야 놀자, 안녕달 수박 수영장, 백희나 장수탕 선녀님, 한태희, 김영진, 이억배, 류재수 etc.) AND well-loved Korean editions. For EACH: correct **한글 title**, **author (한글)**, **publisher (한글)**, approximate age band(s), reading level, 2–4 theme tags, 1–2 mood tags, one accurate why-it-fits sentence (한국어), one read-aloud tip (한국어). Real titles only — NO invented books.
>
> **Pool B — English picture-book canon (~45 titles):** the global canon a bilingual family would want (The Very Hungry Caterpillar, The Gruffalo, Where the Wild Things Are, Goodnight Moon, Brown Bear Brown Bear, We're Going on a Bear Hunt, Dear Zoo, Each Peach Pear Plum, The Tiger Who Came to Tea, Room on the Broom, Guess How Much I Love You, Press Here, Don't Let the Pigeon Drive the Bus, The Snail and the Whale, Stick Man, Julia Donaldson / Eric Carle / Mo Willems / Oliver Jeffers staples, etc.). For EACH: English title, author, publisher, **a real ISBN-13** (for cover lookup — verify it resolves on openlibrary.org), age band(s), level, theme tags, mood tags, why-it-fits sentence written **in Korean** (for the Korean parent), read-aloud tip in Korean.
>
> **Age bands:** "0-2" (보드북), "3-4", "5-6", "7-9". **Levels:** 보드북 / 그림책 / 책읽기 / 초기챕터북. **Theme vocabulary (reuse these exact strings):** 공룡, 우주, 동물, 공주, 자동차, 탈것, 그림그리기, 잠자리, 자연, 음식, 가족, 친구, 감정, 일상, 환상, 모험, 숫자/글자, 유머. **Mood vocabulary:** 웃긴, 따뜻한, 모험, 학습, 잔잔한.
>
> **Errors to avoid (report these too):** do NOT invent titles/authors/ISBNs; do NOT romanize Korean titles as the primary form; do NOT list translated-Chinese TCM-style filler; do NOT recommend age-inappropriate content; do NOT use US-library jargon. Flag any title you are <90% sure is real.
>
> Return as a JSON array of objects ready to drop into a JS file, each matching: `{id, lang, title, titleRoman?, author, publisher, ages:[], level, themes:[], mood:[], blurb, readAloud, cover:{emoji,palette:[]}, isbn?, source:"curated"}`. Also return a short "errors_to_avoid" list (8–12 items) for the AI prompt, and 10–15 canonical author names for the prompt's `<canonical_authors>`.

Save the agent's returned `errors_to_avoid` + canonical authors into the plan's Task 5 notes (or a scratch file) — Task 5 needs them.

- [ ] **Step 2: Write `kids-bookshelf/catalog.js`**

Header comment = the schema contract, then the data. Structure:

```js
/*
 * 책친구 catalog — append-only book data for the kids-bookshelf demo.
 *
 * TO ADD A BOOK: append one object to BOOKS below. No other file changes needed —
 * scoring, rendering, and the AI prompt all read this array dynamically.
 *
 * Schema (every field except titleRoman/isbn is required):
 *   id         string  stable kebab slug, globally unique, NEVER reused   e.g. "kr-gureumppang"
 *   lang       "ko"|"en"   drives the 🇰🇷/🇬🇧 flag and cover behavior
 *   title      string  canonical title in its own script (한글 for ko)
 *   titleRoman string? optional romanization, EN-reader reference only
 *   author     string  in its own script
 *   publisher  string
 *   ages       string[]  subset of ["0-2","3-4","5-6","7-9"]
 *   level      "보드북"|"그림책"|"책읽기"|"초기챕터북"
 *   themes     string[]  from THEME_VOCAB (see below)
 *   mood       string[]  from MOOD_VOCAB
 *   blurb      string  curated "왜 이 책일까요?" sentence (한국어)
 *   readAloud  string  one-line "함께 읽기 팁" (한국어)
 *   cover      {emoji:string, palette:string[]}  for the SVG placeholder cover
 *   isbn       string?  ISBN-13; EN titles use it for an Open Library cover swap
 *   source     "curated"|"ai"   curated launch data; "ai" = promoted suggestion
 *
 * Controlled vocabularies (keep chips/scoring in sync with these):
 *   THEME_VOCAB: 공룡 우주 동물 공주 자동차 탈것 그림그리기 잠자리 자연 음식 가족 친구 감정 일상 환상 모험 숫자/글자 유머
 *   MOOD_VOCAB:  웃긴 따뜻한 모험 학습 잔잔한
 */
window.THEME_VOCAB = ["공룡","우주","동물","공주","자동차","탈것","그림그리기","잠자리","자연","음식","가족","친구","감정","일상","환상","모험","숫자/글자","유머"];
window.MOOD_VOCAB  = ["웃긴","따뜻한","모험","학습","잔잔한"];
window.BOOKS = [
  // ...the ~90 researched objects, Korean pool then English pool...
];
```

Paste the researched objects into `BOOKS`. Aim for ~45 ko + ~45 en. Drop any title the research flagged as <90% certain.

- [ ] **Step 3: Verify the catalog is well-formed**

Run a throwaway node check (no test framework in repo):

```bash
cd /home/ubuntu/projects/vibe-demos
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

Expected: `catalog OK`, total ≈ 90, ko and en each ≈ 45. Fix any reported errors in `catalog.js` and re-run until clean.

- [ ] **Step 4: Write `kids-bookshelf/CATALOG.md`**

A short doc mirroring the schema header + the controlled vocabularies + a worked "how to add a book" example (one full object). This is the human-facing append guide referenced in the spec.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/catalog.js kids-bookshelf/CATALOG.md
git commit -m "kids-bookshelf: researched bilingual book catalog + schema doc

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: `index.html` skeleton + crayon styling + picker UI

**Files:**
- Create: `kids-bookshelf/index.html`

Build the static shell: head tags, crayon CSS, the picker form, an empty results area. No JS logic yet beyond reading nothing. This task is "it renders and looks like the preview".

- [ ] **Step 1: Write the head + PWA tags + crayon CSS + picker markup**

Create `kids-bookshelf/index.html` with:

Head (after charset/viewport/title `우리 아이 책 친구 📚`):
```html
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="apple-touch-icon" href="icon.svg">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#f7b733">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="책친구">
```

CSS design tokens (cream paper + bright kid pastels, NOT the landing's editorial palette):
```css
:root{
  --paper:#fbf3e2; --ink:#3a3026; --accent:#e8643c; --accent2:#f7b733;
  --blue:#7ec4e6; --green:#9cd07f; --pink:#f4a6c0; --purple:#c4a6e6;
  --chip:#fff; --shadow:rgba(58,48,38,.12);
  font-size:17px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;
  -webkit-text-size-adjust:100%;}
```

Add an SVG turbulence filter (the crayon-edge look) once near top of `<body>`:
```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="crayon"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4"/></filter>
</svg>
```
Apply `filter:url(#crayon)` to bordered cards/buttons for the wobbly edge. Title uses a heavy rounded display feel (system fallback is fine; do NOT pull a webfont — keep self-contained).

Picker markup (sections: 나이 single-select, 성별 single-select default 상관없음, 좋아하는 것 multi chips generated from `THEME_VOCAB` + emoji map, 분위기 multi chips from `MOOD_VOCAB`, 한마디 textarea, big CTA `책 찾아주세요! ✏️`). Use `<button class="chip" data-val="공룡" aria-pressed="false">🦖 공룡</button>` grammar. Provide an emoji map in JS later; for now hardcode emoji into the static chips OR generate them in Task 3. **Decision: generate chips in Task 3 from the vocab** so they stay in sync — so here just leave `<div id="themeChips"></div>` and `<div id="moodChips"></div>` empty containers.

Add the results region: `<section id="results" aria-live="polite"></section>` and a hidden AI-mode toggle area (built in Task 5).

Include the catalog + app script tags before `</body>`:
```html
<script src="./catalog.js"></script>
<script src="./app.js"></script>
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
</script>
```
**Decision:** put app logic in a separate `kids-bookshelf/app.js` (classic script) rather than inline — keeps `index.html` focused and lets `node --check app.js` validate it directly. Create an empty `app.js` in this task so the page loads without 404.

Add `@media (prefers-reduced-motion: reduce)` block that disables wiggle/draw-on animations.

- [ ] **Step 2: Create empty `kids-bookshelf/app.js`**

```js
/* 책친구 — app logic. Reads window.BOOKS / THEME_VOCAB / MOOD_VOCAB from catalog.js. */
"use strict";
// (filled in Tasks 3–5)
```

- [ ] **Step 3: Syntax-check both files**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
# HTML has no checker; confirm the file exists and the script tags are present:
grep -c 'catalog.js\|app.js\|sw.js' kids-bookshelf/index.html   # expect 3
```
Expected: `app.js OK` and `3`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/index.html kids-bookshelf/app.js
git commit -m "kids-bookshelf: crayon picture-book shell + picker UI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Picker interactivity + scoring engine + chip generation

**Files:**
- Modify: `kids-bookshelf/app.js`

- [ ] **Step 1: Generate chips from the vocab + an emoji map**

In `app.js`, add the emoji map and a renderer that fills `#themeChips` / `#moodChips`:

```js
const THEME_EMOJI = {
  "공룡":"🦖","우주":"🚀","동물":"🐱","공주":"👑","자동차":"🚗","탈것":"🚂",
  "그림그리기":"🎨","잠자리":"🌙","자연":"🌳","음식":"🍪","가족":"👨‍👩‍👧","친구":"🤝",
  "감정":"💛","일상":"🏠","환상":"✨","모험":"🗺️","숫자/글자":"🔤","유머":"😆"
};
const MOOD_EMOJI = { "웃긴":"😆","따뜻한":"🤗","모험":"🗺️","학습":"📚","잔잔한":"🌿" };

function chip(val, emoji){
  return `<button type="button" class="chip" data-val="${val}" aria-pressed="false">${emoji} ${val}</button>`;
}
document.getElementById("themeChips").innerHTML =
  window.THEME_VOCAB.map(t => chip(t, THEME_EMOJI[t]||"•")).join("");
document.getElementById("moodChips").innerHTML =
  window.MOOD_VOCAB.map(m => chip(m, MOOD_EMOJI[m]||"•")).join("");
```

- [ ] **Step 2: Wire selection state (single vs multi) + read the profile**

```js
// delegated toggle: age & gender groups are single-select, themes & moods multi.
function wireGroup(containerId, single){
  const el = document.getElementById(containerId);
  el.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    if (single) el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c===b ? "true":"false"));
    else b.setAttribute("aria-pressed", b.getAttribute("aria-pressed")==="true" ? "false":"true");
  });
}
["ageChips","genderChips"].forEach(id => wireGroup(id, true));
["themeChips","moodChips"].forEach(id => wireGroup(id, false));

function readProfile(){
  const sel = (id) => [...document.getElementById(id).querySelectorAll('.chip[aria-pressed="true"]')].map(c=>c.dataset.val);
  return {
    age: sel("ageChips")[0] || null,          // single
    gender: sel("genderChips")[0] || "상관없음",
    themes: sel("themeChips"),
    moods: sel("moodChips"),
    note: (document.getElementById("noteBox").value||"").trim()
  };
}
```
(Task 2 must therefore include `#ageChips`, `#genderChips`, `#noteBox`. If they were not added, add them now in `index.html` — age chips: 0-2/3-4/5-6/7-9; gender chips: 남아/여아/상관없음 with 상관없음 pre-pressed.)

- [ ] **Step 3: Implement the scoring function**

```js
// Score one book against the profile. Higher = better fit. Age is a soft gate.
function scoreBook(b, p){
  let s = 0;
  // age band: strong signal. exact band match big; adjacent band small; none = heavy penalty
  if (p.age){
    if (b.ages.includes(p.age)) s += 5;
    else {
      const order = ["0-2","3-4","5-6","7-9"];
      const pi = order.indexOf(p.age);
      const adj = b.ages.some(a => Math.abs(order.indexOf(a)-pi)===1);
      s += adj ? 1.5 : -4;
    }
  }
  // themes: each overlap is a solid hit
  s += b.themes.filter(t => p.themes.includes(t)).length * 3;
  // moods: lighter
  s += b.mood.filter(m => p.moods.includes(m)).length * 2;
  // free-text keyword nudge: any theme/title word appearing in the note
  if (p.note){
    const note = p.note.toLowerCase();
    if (b.themes.some(t => note.includes(t.toLowerCase()))) s += 2;
    if (note.includes(b.title.toLowerCase())) s += 4;
  }
  // gender: soft nudge only — never a hard filter (design: 상관없음 default)
  // (no gender field on books at launch; reserved hook — leave as 0)
  // tiny deterministic jitter by id so ties don't always order the same
  s += (b.id.charCodeAt(b.id.length-1) % 7) * 0.01;
  return s;
}
```

- [ ] **Step 4: Implement the balanced top-6 selector + shuffle seed**

```js
let shuffleSalt = 0;
function recommend(p){
  const scored = window.BOOKS
    .map(b => ({ b, s: scoreBook(b,p) + ((b.id.length*7 + shuffleSalt*13) % 11)*0.02 }))
    .filter(x => x.s > -2)               // drop hard age-mismatches
    .sort((a,b) => b.s - a.s);
  const ko = scored.filter(x => x.b.lang==="ko");
  const en = scored.filter(x => x.b.lang==="en");
  // aim 3 + 3, backfill from whichever pool has more if one is short
  const pick = [...ko.slice(0,3), ...en.slice(0,3)];
  if (pick.length < 6){
    const used = new Set(pick.map(x=>x.b.id));
    for (const x of scored){ if(pick.length>=6) break; if(!used.has(x.b.id)) pick.push(x); }
  }
  return pick.map(x => x.b);
}
```

- [ ] **Step 5: Syntax-check + a logic smoke test**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
# smoke: load catalog + a trimmed copy of scoreBook/recommend by requiring catalog and re-declaring? 
# Simpler: assert recommend returns 6 for a normal profile using a node harness:
node -e '
  global.window = {};
  require("./kids-bookshelf/catalog.js");
  // inline copies of the two functions for the smoke test:
  '"$(sed -n '/^function scoreBook/,/^}/p;/^let shuffleSalt/,/^}/p' kids-bookshelf/app.js)"'
  const p = {age:"3-4", gender:"상관없음", themes:["동물","음식"], moods:["따뜻한"], note:""};
  const r = recommend(p);
  console.log("got", r.length, "recs; langs:", r.map(b=>b.lang).join(","));
  if (r.length !== 6) { console.error("expected 6"); process.exit(1); }
  console.log("scoring OK");
'
```
Expected: `app.js OK` then `got 6 recs; ...` and `scoring OK`. (The `sed` pulls the two functions out of `app.js` so the harness tests the real code.)

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/app.js kids-bookshelf/index.html
git commit -m "kids-bookshelf: chip picker + rule-based bilingual scoring engine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Card rendering + SVG crayon covers + Open Library cover swap

**Files:**
- Modify: `kids-bookshelf/app.js`
- Modify: `kids-bookshelf/index.html` (results CSS)

- [ ] **Step 1: SVG placeholder cover generator**

```js
// A crayon mini-book cover: framed rect, emoji, title wrapped. Always renders, never breaks.
function svgCover(b){
  const [c1, c2] = (b.cover.palette.length>=2 ? b.cover.palette : [b.cover.palette[0]||"#ffe", "#fff"]);
  const title = b.title.length>14 ? b.title.slice(0,13)+"…" : b.title;
  return `<svg viewBox="0 0 120 150" class="cv" role="img" aria-label="${escapeHtml(b.title)} 표지">
    <rect x="4" y="4" width="112" height="142" rx="7" fill="${c1}" stroke="var(--ink)" stroke-width="2.4" filter="url(#crayon)"/>
    <rect x="12" y="12" width="96" height="80" rx="5" fill="${c2}" opacity=".85"/>
    <text x="60" y="64" font-size="44" text-anchor="middle" dominant-baseline="central">${b.cover.emoji}</text>
    <text x="60" y="116" font-size="12" text-anchor="middle" fill="var(--ink)" font-weight="700">${escapeHtml(title)}</text>
  </svg>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
```

- [ ] **Step 2: Card renderer (XSS-safe via escapeHtml on all book data)**

```js
const FLAG = { ko:"🇰🇷", en:"🇬🇧" };
function cardHtml(b, reason, tip, tag){
  // reason/tip default to curated; AI mode passes overrides. tag marks AI/도전 picks.
  reason = reason || b.blurb; tip = tip || b.readAloud;
  const lvl = escapeHtml(b.level);
  const meta = escapeHtml(b.author) + (b.publisher ? " · " + escapeHtml(b.publisher) : "");
  return `<article class="bookcard" data-isbn="${b.lang==="en" && b.isbn ? escapeHtml(b.isbn) : ""}">
    <div class="cover">${svgCover(b)}</div>
    <div class="info">
      <div class="toprow"><span class="flag">${FLAG[b.lang]||""}</span>
        <span class="lvl">${lvl}</span>${tag ? `<span class="aitag">${escapeHtml(tag)}</span>`:""}</div>
      <h3 class="btitle">${escapeHtml(b.title)}</h3>
      <div class="bmeta">${meta}</div>
      <p class="why"><b>왜 이 책일까요?</b> ${escapeHtml(reason)}</p>
      <p class="tip"><b>함께 읽기 팁</b> ${escapeHtml(tip)}</p>
    </div>
  </article>`;
}
```

- [ ] **Step 3: Render + lazy Open Library cover swap for English ISBNs**

```js
function renderResults(books, opts){
  opts = opts || {};
  const wrap = document.getElementById("results");
  wrap.innerHTML = `<div class="resbar"><span>${books.length}권 추천${opts.modeLabel||""}</span>
    <button id="reroll" class="reroll" type="button">다시 추천 🎲</button></div>
    <div class="grid">${books.map(b => cardHtml(b, opts.reasons?.[b.id], opts.tips?.[b.id], opts.tags?.[b.id])).join("")}</div>`;
  // lazy real-cover swap (English ISBNs only). Open Library; silent fallback to SVG.
  wrap.querySelectorAll(".bookcard[data-isbn]").forEach(card => {
    const isbn = card.getAttribute("data-isbn"); if(!isbn) return;
    const img = new Image();
    img.onload = () => { if(img.naturalWidth>2){ const c=card.querySelector(".cover");
      c.innerHTML = `<img class="realcover" src="${img.src}" alt="" loading="lazy">`; } };
    img.src = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`;
  });
  // staggered draw-on (skipped under prefers-reduced-motion via CSS)
  wrap.querySelectorAll(".bookcard").forEach((c,i)=> c.style.setProperty("--i", i));
}
```
Note: `?default=false` makes Open Library return a 1×1 (or 404) instead of a blank placeholder when it has no cover, so `naturalWidth>2` reliably detects a real hit.

- [ ] **Step 4: Wire the CTA + reroll**

```js
function runRecommend(){
  const p = readProfile();
  const books = recommend(p);
  renderResults(books, { modeLabel: ' · 추천 예시' });   // canned-mode label
  document.getElementById("results").scrollIntoView({behavior:"smooth", block:"start"});
}
document.getElementById("findBtn").addEventListener("click", runRecommend);
document.getElementById("results").addEventListener("click", e => {
  if (e.target.closest("#reroll")) { shuffleSalt++; runRecommend(); }
});
```
(Ensure the CTA button in `index.html` has `id="findBtn"`.)

- [ ] **Step 5: Results CSS in `index.html`**

Add a responsive `.grid` (1 col mobile, 2 col ≥640px), `.bookcard` with wobbly border (`filter:url(#crayon)` on a pseudo-border or box-shadow), `.cover svg`/`.realcover` sizing (fixed aspect box so the swap doesn't reflow), `.flag/.lvl/.aitag` pills, `.resbar`/`.reroll` styling, and the `--i` staggered `@keyframes drawOn` (opacity+slight translate), disabled under `prefers-reduced-motion`. The "추천 예시" label is the canned-mode pill per CLAUDE.md.

- [ ] **Step 6: Syntax-check + render smoke via the playtest driver**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
```
Then render-verify with the cached Playwright/chromium driver (see memory `project_tinywings_playtest_driver`): load `file://.../kids-bookshelf/index.html`, click some chips + the CTA, screenshot, and confirm 6 cards render with flags + covers. (Headless — no user action needed.) If the driver isn't reachable, note it and rely on the node checks; do NOT claim render-verified if you didn't.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/app.js kids-bookshelf/index.html
git commit -m "kids-bookshelf: card render, crayon SVG covers, Open Library swap

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: AI mode (optional) — proxy call + domain-tuned prompt

**Files:**
- Modify: `kids-bookshelf/app.js`
- Modify: `kids-bookshelf/index.html` (AI toggle UI + crayon-scribble loader)

The proxy is **non-streaming** (`stream:true` → 400). AI mode = one POST, with a crayon-scribble progress line while it works.

- [ ] **Step 1: Add the PoW solver + proxy constant (cribbed from changwon)**

```js
const CLAUDE_PROXY = "https://ai.pb.gurum.se";
async function solveProxyPoW(){
  const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge");
  if(!r.ok){ const e=new Error("challenge "+r.status); e.status=r.status; throw e; }
  const { nonce, exp, sig, difficulty } = await r.json();
  const enc = new TextEncoder();
  const leadBits = (buf)=>{ const b=new Uint8Array(buf); let bits=0;
    for(const x of b){ if(x===0){bits+=8;continue;} let v=x,c=0; while((v&0x80)===0){c++;v<<=1;} bits+=c; break; } return bits; };
  for(let counter=0;;counter++){
    const d = await crypto.subtle.digest("SHA-256", enc.encode(nonce+":"+counter));
    if(leadBits(d)>=difficulty) return { "X-PoW-Nonce":nonce,"X-PoW-Exp":exp,"X-PoW-Sig":sig,"X-PoW-Counter":String(counter) };
    if(counter>5000000) throw new Error("pow-timeout");
  }
}
```

- [ ] **Step 2: Build the domain-tuned system prompt (XML-tagged)**

Use the research agent's `errors_to_avoid` + canonical authors from Task 1. Schema MUST match the render: AI returns a JSON object keyed by book `id` with `{reason, tip}`, plus optional `extra` picks.

```js
function buildSys(){
  return `<role>당신은 한국 어린이도서관의 그림책 큐레이터입니다. 0~9세 아이를 키우는 한국 부모에게 책을 추천합니다. 당신은 영미권 사서가 아니라, 한국 그림책 문화와 영어권 그림책 정전을 모두 아는 이중언어 큐레이터입니다.</role>
<voice>따뜻하고 구체적인 한국어. 부모가 아이와 함께 읽는 장면이 그려지도록. 과장·광고 문구 금지. 한 추천 이유는 1~2문장.</voice>
<reasoning_order>1) 아이 나이대에 맞는 책인지 확인 2) 관심사·분위기와 어떻게 맞는지 3) 함께 읽을 때의 팁을 떠올린다 4) 한국 책과 영어 책을 균형 있게.</reasoning_order>
<canonical_books>아래 catalog의 책만 사용해 추천 이유를 씁니다. 목록에 없는 책을 추천 이유로 지어내지 마세요. (catalog는 user 메시지에 JSON으로 제공됩니다.)</canonical_books>
<canonical_authors>${/* paste 10-15 names from research */ "백희나, 권정생, 이수지, 안녕달, Eric Carle, Julia Donaldson, Mo Willems, Oliver Jeffers …"}</canonical_authors>
<errors_to_avoid>
${/* paste the 8-12 researched items, numbered */ "1) 없는 책·작가·줄거리를 지어내지 말 것. 2) 한글 제목을 로마자로 바꾸지 말 것. 3) 나이에 안 맞는 책 추천 금지. 4) 번역투·광고문구 금지. …"}
</errors_to_avoid>
<output_constraints>catalog에서 받은 추천 후보 각각에 대해 reason(1~2문장)과 tip(한 줄)을 한국어로 작성. 추가로 catalog에 없지만 아주 잘 맞는 책을 최대 2권까지 "extra"로 제안할 수 있고, 그 책에는 도전 추천임을 표시.</output_constraints>
<output_schema>{"items":{"<book id>":{"reason":"...","tip":"..."}}, "extra":[{"title":"...","author":"...","lang":"ko|en","reason":"...","tip":"..."}]}  순수 JSON만, 코드펜스 없이.</output_schema>`;
}
```

- [ ] **Step 3: The AI call — re-explain the catalog picks**

```js
async function aiRecommend(p, books){
  const sys = buildSys();
  const candidates = books.map(b => ({ id:b.id, lang:b.lang, title:b.title, author:b.author,
    ages:b.ages, level:b.level, themes:b.themes, mood:b.mood }));
  const user = `아이 정보: 나이 ${p.age||"미정"}, 성별 ${p.gender}, 관심사 [${p.themes.join(", ")||"없음"}], 분위기 [${p.moods.join(", ")||"없음"}]\n부모 한마디: ${p.note||"(없음)"}\n\n추천 후보 catalog(JSON):\n${JSON.stringify(candidates)}\n\n각 후보에 대한 추천 이유와 팁을 위 스키마(JSON)로만 답하세요.`;
  const pow = await solveProxyPoW();
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json", ...pow },
    body: JSON.stringify({ model:"sonnet", max_tokens:1600, system:sys,
      messages:[{ role:"user", content:user }] })
  });
  if(!res.ok){ const e=new Error("proxy "+res.status); e.status=res.status; throw e; }
  const j = await res.json();
  const txt = (j.content && j.content[0] && j.content[0].text) || "{}";
  return JSON.parse(txt.replace(/^```json\s*|\s*```$/g,"").trim());   // tolerate stray fences
}
```

- [ ] **Step 4: AI toggle UI + crayon-scribble loader + wire-up**

In `index.html`: add an "✨ AI 맞춤 추천" toggle near the CTA (off by default — catalog mode is the default per canned-first). Add a `.scribble` loader element (an animated dashed crayon line; CSS `@keyframes`, disabled under reduced-motion).

In `app.js`, branch `runRecommend`:
```js
async function runRecommend(){
  const p = readProfile();
  const books = recommend(p);
  const aiOn = document.getElementById("aiToggle")?.getAttribute("aria-pressed")==="true";
  if(!aiOn){ renderResults(books, { modeLabel:" · 추천 예시" }); scrollResults(); return; }
  renderResults(books, { modeLabel:" · AI 생성 중…", loading:true });   // renderResults shows .scribble when opts.loading
  scrollResults();
  try{
    const out = await aiRecommend(p, books);
    const reasons={}, tips={}, tags={};
    for(const b of books){ const it = out.items?.[b.id]; if(it){ reasons[b.id]=it.reason; tips[b.id]=it.tip; } }
    let extras = (out.extra||[]).slice(0,2).map((x,i)=>({
      id:"ai-"+i, lang:x.lang==="en"?"en":"ko", title:x.title, author:x.author||"", publisher:"",
      ages:[p.age||"3-4"], level:"그림책", themes:[], mood:[], blurb:x.reason, readAloud:x.tip,
      cover:{emoji:"✨", palette:["#fff3d6","#ffe"]}, source:"ai"
    }));
    const all=[...books,...extras];
    extras.forEach(e=>{ reasons[e.id]=e.blurb; tips[e.id]=e.readAloud; tags[e.id]="✨ 도전 추천"; });
    renderResults(all, { modeLabel:" · AI 맞춤 추천", reasons, tips, tags });
  }catch(err){
    renderResults(books, { modeLabel:" · 추천 예시", aiError:true });   // graceful fallback to curated blurbs
  }
}
```
(Update `renderResults` to honor `opts.loading` → show `.scribble` and skip the cover swap until done, and `opts.aiError` → show a soft "AI 추천을 지금 불러올 수 없어 기본 추천을 보여드려요" note. Keep `scrollResults()` as a tiny helper.)

- [ ] **Step 5: Syntax-check**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/app.js && echo "app.js OK"
grep -c "aiToggle\|scribble\|findBtn" kids-bookshelf/index.html   # expect >=3
```
Expected: `app.js OK` and a count ≥3.

- [ ] **Step 6: Live AI smoke test (optional, network-dependent)**

If network to the proxy is available, verify the round-trip with a node fetch reproducing the PoW + call (or note it as deferred to manual browser check). Do NOT block the plan on proxy reachability; the demo must work fully in catalog mode regardless.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/app.js kids-bookshelf/index.html
git commit -m "kids-bookshelf: optional AI mode via Bedrock proxy, domain-tuned prompt

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: PWA shell — manifest, icon, service worker

**Files:**
- Create: `kids-bookshelf/manifest.webmanifest`
- Create: `kids-bookshelf/icon.svg`
- Create: `kids-bookshelf/sw.js`

- [ ] **Step 1: `manifest.webmanifest`**

```json
{
  "name": "책친구 — 우리 아이 책 추천",
  "short_name": "책친구",
  "description": "나이·관심사·분위기로 한국어·영어 그림책을 함께 추천해 주는 우리 아이 책 친구.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#fbf3e2",
  "theme_color": "#f7b733",
  "lang": "ko",
  "categories": ["education", "lifestyle", "books"],
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: `icon.svg` — a distinctive crayon-book glyph**

A 64×64 SVG on cream (`#fbf3e2`), an open picture-book in the warm accent palette (`#e8643c`/`#f7b733`) with a small crayon or star. Follow the visual grammar of `changwon-homes/icon.svg` (rounded rect bg, simple filled shapes) but make it a book — NOT a reused mark. Apply a subtle wobble if cheap, else keep clean.

- [ ] **Step 3: `sw.js` — cache `vibe-kids-bookshelf-v1`, skip proxy + covers**

Copy `changwon-homes/sw.js` structure, with:
```js
const CACHE = "vibe-kids-bookshelf-v1";
const SHELL = ["./","./index.html","./app.js","./catalog.js","./manifest.webmanifest","./icon.svg"];
```
The cross-origin guard (`if (new URL(req.url).origin !== self.location.origin) return;`) already excludes `ai.pb.gurum.se` and `covers.openlibrary.org` from caching — keep it. Confirm the comment names them.

- [ ] **Step 4: Verify**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check kids-bookshelf/sw.js && echo "sw OK"
node -e 'JSON.parse(require("fs").readFileSync("kids-bookshelf/manifest.webmanifest","utf8")); console.log("manifest JSON OK")'
head -1 kids-bookshelf/icon.svg | grep -q "<svg" && echo "icon OK"
```
Expected: `sw OK`, `manifest JSON OK`, `icon OK`.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add kids-bookshelf/manifest.webmanifest kids-bookshelf/icon.svg kids-bookshelf/sw.js
git commit -m "kids-bookshelf: PWA shell (manifest, crayon-book icon, scoped SW)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Repo maintenance contract — works index, count, thumbnail, README, CATALOG

**Files:**
- Modify: `index.html` (works index row + count)
- Create: `thumbs/kids-bookshelf.jpg`
- Modify: `README.md`

- [ ] **Step 1: Add the works-index row (#11) after the changwon row (line ~690)**

Match the row grammar exactly. Italicise one focal word (책):
```html
      <a class="work" href="./kids-bookshelf/">
        <span class="num">11</span>
        <span class="title" lang="ko">우리 아이 <em>책</em></span>
        <span class="tags"><span lang="ko">그림책 추천</span> · 한·영<br><span lang="ko">나이·관심사 맞춤</span><br>Curated + Claude AI</span>
        <span class="thumb"><img src="./thumbs/kids-bookshelf.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async"></span>
        <span class="year">2026</span>
        <span class="arrow">→</span>
      </a>
```

- [ ] **Step 2: Bump the count**

In `index.html` change `Index / 10 entries` → `Index / 11 entries`.

- [ ] **Step 3: Create the thumbnail `thumbs/kids-bookshelf.jpg` (1280×720)**

Generate a 1280×720 thumbnail in the crayon picture-book register (cream paper, a few book covers / emoji, the title 책친구). Options, in order of preference:
1. Use the `bedrock-image-mcp-server` `generate_image` tool with a prompt like: *"warm cream paper children's picture-book illustration, a small stack of crayon-drawn picture books with a dinosaur, rocket and cat on the covers, hand-drawn wobbly crayon style, soft pastel palette, flat editorial, no text, 16:9"*. Then downscale/crop to exactly 1280×720 (`sips`/`magick`/`ffmpeg`).
2. If the image tool is unavailable, render the demo's own results screen via the playtest driver at 1280×720 and screenshot it.

Confirm dimensions:
```bash
cd /home/ubuntu/projects/vibe-demos
file thumbs/kids-bookshelf.jpg
# if imagemagick present:
identify -format "%wx%h\n" thumbs/kids-bookshelf.jpg 2>/dev/null || true   # expect 1280x720
```

- [ ] **Step 4: Add the README bullet**

In `README.md` under `## Live demos`, append after the changwon bullet:
```markdown
- [책친구 — Kids Book Friend](./kids-bookshelf/) — Korean-language, crayon-picture-book recommender for 0–9-year-olds. Tap in your child's age, gender, interests (공룡·우주·동물…) and mood, add an optional free-text note, and get ~6 real-book recommendations balanced across **Korean 그림책 and English picture-book canon** (🇰🇷/🇬🇧 flagged) from a hand-curated, append-only catalog. Each card shows a crayon SVG cover (English titles lazy-swap a real Open Library cover), level badge, a "왜 이 책일까요?" reason, and a read-aloud tip. Default catalog mode works with no key; an optional **AI 맞춤 추천** mode (Claude Sonnet via the shared Bedrock proxy) personalizes the reasons from the free-text note and can add 1–2 off-catalog "도전" picks. PWA, client-only, no backend.
```

- [ ] **Step 5: Verify counts are consistent**

```bash
cd /home/ubuntu/projects/vibe-demos
grep -c 'class="work" href' index.html        # expect 11
grep -o 'Index / [0-9]* entries' index.html    # expect "Index / 11 entries"
grep -c 'kids-bookshelf' README.md             # expect >=1
```

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add index.html README.md thumbs/kids-bookshelf.jpg
git commit -m "studio: add 책친구 kids book recommender as entry 11

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Final integration check + deploy verification

**Files:** none (verification only)

- [ ] **Step 1: Full render walkthrough via the playtest driver**

Headlessly load `kids-bookshelf/index.html`, exercise: pick an age, pick 2 interests, pick a mood, type a note, click 책 찾아주세요!, confirm 6 cards with flags/covers/level/reason/tip render and the canned "추천 예시" label shows; click 다시 추천 and confirm the set changes; toggle AI mode and confirm it either returns AI reasons (if proxy reachable) or falls back gracefully. Screenshot for the record. Report honestly what was and wasn't exercised.

- [ ] **Step 2: Push to main**

```bash
cd /home/ubuntu/projects/vibe-demos
git push origin main
```

- [ ] **Step 3: Deploy verification (wait ~45s for Pages build)**

```bash
sleep 45
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/kids-bookshelf/   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/kids-bookshelf/catalog.js   # expect 200
curl -s https://kalleeh.github.io/vibe-demos/ | grep -c "kids-bookshelf"   # expect >=1 (may lag a build; retry once)
```
Expected: `200`, `200`, and `>=1`. If the landing grep returns 0, wait another 30s and retry (Pages caches the prior build briefly).

- [ ] **Step 4: Report**

Summarize: demo live at the URL, entry #11 in the index, catalog size, AI mode status (verified live vs. fallback-only), and any caveats (e.g. Korean covers are placeholder-only by design).

---

## Self-Review notes

- **Spec coverage:** bilingual two-pool catalog (T1), extensibility/append-only/`source` field (T1 + CATALOG.md), curated scoring + 3+3 balance + reshuffle (T3), cards w/ flag·cover·level·reason·tip (T4), never-broken cover policy + Open Library swap for EN ISBNs (T4), crayon picture-book aesthetic + reduced-motion (T2/T4/T5), playful picker + free text (T2/T3), AI mode via proxy + domain-tuned prompt + off-catalog 도전 picks (T5), PWA shell skipping proxy+covers (T6), works-index #11 + count + thumb + README + CATALOG.md (T1/T7), no PocketBase (stated). All covered.
- **Spec deviation (intentional):** spec's loader note mentioned "streaming text as it arrives"; the shared proxy rejects `stream:true` (verified in `ai/pb/pb_hooks/proxy.pb.js`), so AI mode is non-streaming with the crayon-scribble loader only. Noted in T5.
- **Type consistency:** `readProfile()` shape `{age,gender,themes,moods,note}` is used identically in `scoreBook`, `recommend`, `aiRecommend`, `runRecommend`. `recommend()` returns book objects; `renderResults(books, opts)` with `opts.reasons/tips/tags/modeLabel/loading/aiError` is consistent across T4 and T5. `cardHtml(b, reason, tip, tag)` signature stable. Catalog field names match the schema header in T1 and the node validator in T1 Step 3.
- **Placeholder scan:** the two `${/* paste ... */}` spots in T5 Step 2 are deliberate fill-from-research handoffs (the research output from T1 supplies them) — not vague instructions; the surrounding code is complete.
