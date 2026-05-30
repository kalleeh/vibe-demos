# 16유형 도감 (Type Gallery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third tab to `korean-mbti/index.html` — a browsable gallery of all 16 MBTI types, grouped by temperament into four palette-tinted sections, each card showing a portrait + code + short nickname; clicking opens a result-style detail (portrait + 女/男 toggle, nickname, one-liner, vibes, function stack) with the 4축 bars replaced by an explanatory note linking to the test.

**Architecture:** Pure static addition to a single self-contained HTML file. New `#panel-gallery` with two swappable inner views (`#gallery-grid`, `#gallery-detail`). Reuses existing `TYPES`, `FN_STACKS`, `renderFnStack()`, `portraitPath()`/`getGender()`, and the existing tab-switch handler (line ~2216, which already iterates all `.tab`s). The result-screen portrait hero is extracted into a shared `renderPortrait()` helper so the gallery and the real result screen share code. No new files, no images, no AI calls, no dependencies.

**Tech Stack:** Plain HTML/CSS/vanilla JS (no build, no framework). Verification via `node` inline-script syntax check + `grep` + manual browser load.

---

## Testing approach (read first)

This repo has **no test framework by design** (no package.json, static demos). "Tests" in this plan = deterministic verification commands:

- **Syntax gate** (run after every JS change):
  ```bash
  node -e 'const fs=require("fs");const h=fs.readFileSync("korean-mbti/index.html","utf8");const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];let ok=true;m.forEach((s,i)=>{try{new Function(s[1])}catch(e){ok=false;console.log("Block "+i+" ERROR:",e.message)}});console.log(ok?"OK "+m.length+" blocks":"FAILED")'
  ```
  Expected: `OK 2 blocks`
- **Logic gate** for pure functions: extract the function into a throwaway `node` snippet with sample data and assert the output (shown per-task).
- **Render gate:** serve locally and eyeball — `python3 -m http.server 8000 -d /home/ubuntu/projects/vibe-demos` then open `localhost:8000/korean-mbti/`.

Run all commands from repo root `/home/ubuntu/projects/vibe-demos`.

---

## File structure

Single file modified throughout: **`korean-mbti/index.html`**. Plus **`korean-mbti/sw.js`** (cache bump). The change is organized into regions that already exist in the file:

| Region | Lines (approx) | What changes |
|---|---|---|
| Tabs markup | ~1330–1339 | add third `.tab` |
| Panels markup | after ~1387 (end of `#panel-ai`) | add `#panel-gallery` |
| CSS | near `.axes`/`.fnstack` blocks (~550–870) | add gallery styles |
| Data | after `TYPES`/`FN_STACKS` (~1904) | add `TEMPERAMENT_GROUPS` |
| Render fns | near `renderResultHTML`/`renderFnStack` (~2446–2570) | extract `renderPortrait`, add `renderGallery`, `renderGalleryDetail` |
| Wiring | near tab handler (~2216) + delegated clicks | gallery init + card/back/test-link/gender |

---

## Task 0: Commit the pending clarity work (clean base)

**Files:**
- Commit: `korean-mbti/index.html`, `korean-mbti/sw.js` (already-modified working tree — the axes/stack clarity edits + SW v11 bump from earlier this session).

**Context:** The working tree also contains `tinywings/index.html` and `tinywings/sw.js` changes that are **NOT part of this work** (a stray `__TW_DEBUG_G` debug hook + a tinywings cache bump). Do **not** stage, commit, revert, or touch the tinywings files at any point in this plan.

- [ ] **Step 1: Confirm exactly which files are dirty**

Run:
```bash
git -C /home/ubuntu/projects/vibe-demos status --short
```
Expected: four lines — ` M korean-mbti/index.html`, ` M korean-mbti/sw.js`, ` M tinywings/index.html`, ` M tinywings/sw.js`.

- [ ] **Step 2: Verify the korean-mbti diff is only the clarity edits**

Run:
```bash
git -C /home/ubuntu/projects/vibe-demos diff korean-mbti/index.html | grep "^+" | grep -v "^++" | grep -c "axes-sub\|쓰는 순서\|네 글자\|sort((a, b) => data.ordinal"
```
Expected: `4` (the four clarity edits). If not 4, stop and inspect.

- [ ] **Step 3: Syntax gate**

Run the syntax gate command (see Testing approach). Expected: `OK 2 blocks`.

- [ ] **Step 4: Stage ONLY the two korean-mbti files and commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html korean-mbti/sw.js
git commit -m "korean-mbti: clarify 4축 vs 기능 스택 + fix stack dial ordering

- Sort the function-stack dials by rank (#1→#4) so they match the
  '강한 결부터 약한 결' subtitle promise (was fixed 思·感·直·覺 order).
- Add contrasting subtitles: axes = '유형을 이루는 네 글자', stack =
  '같은 성향을 쓰는 순서로' — so the two sections read as distinct lenses.
- sw.js cache v10 → v11.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Verify tinywings remains untouched & uncommitted**

Run:
```bash
git -C /home/ubuntu/projects/vibe-demos status --short
```
Expected: only ` M tinywings/index.html` and ` M tinywings/sw.js` remain. korean-mbti files gone from the list.

---

## Task 1: Add the temperament-group data

**Files:**
- Modify: `korean-mbti/index.html` — insert after the `DIAL_BUCKETS` array (ends ~line 1912, just before the `computeFnStrengths` comment).

- [ ] **Step 1: Insert the group table**

Find the line:
```javascript
];

// Ranks within stack: dom=4, aux=3, tert=2, inf=1.
```
(this is the close of `DIAL_BUCKETS`). Insert immediately after the `];`:

```javascript

// Temperament groups for the 도감 gallery — order, labels, and bible palette
// anchors (NT lavender / NF coral / SJ sage / SP honey). Each section gets a
// faint wash of its anchor over cream.
const TEMPERAMENT_GROUPS = [
  { key: "NT", label: "NT · 분석가", anchor: "#ADA7FF", types: ["INTJ", "INTP", "ENTJ", "ENTP"] },
  { key: "NF", label: "NF · 외교관", anchor: "#D96E54", types: ["INFJ", "INFP", "ENFJ", "ENFP"] },
  { key: "SJ", label: "SJ · 관리자", anchor: "#9CAA8E", types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"] },
  { key: "SP", label: "SP · 탐험가", anchor: "#E3B25A", types: ["ISTP", "ISFP", "ESTP", "ESFP"] }
];
```

- [ ] **Step 2: Verify all 16 types are covered exactly once**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const TEMPERAMENT_GROUPS=[{types:["INTJ","INTP","ENTJ","ENTP"]},{types:["INFJ","INFP","ENFJ","ENFP"]},{types:["ISTJ","ISFJ","ESTJ","ESFJ"]},{types:["ISTP","ISFP","ESTP","ESFP"]}];
const all=TEMPERAMENT_GROUPS.flatMap(g=>g.types);
const uniq=new Set(all);
const expected="INTJ INTP ENTJ ENTP INFJ INFP ENFJ ENFP ISTJ ISFJ ESTJ ESFJ ISTP ISFP ESTP ESFP".split(" ");
console.log("count="+all.length, "unique="+uniq.size, "allPresent="+expected.every(t=>uniq.has(t)));
'
```
Expected: `count=16 unique=16 allPresent=true`

- [ ] **Step 3: Syntax gate**

Run the syntax gate. Expected: `OK 2 blocks`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: add TEMPERAMENT_GROUPS data for type gallery"
```

---

## Task 2: Extract `renderPortrait()` shared helper

**Files:**
- Modify: `korean-mbti/index.html` — `renderResultHTML()` (~2485–2495) and add a new helper above it.

**Context:** `renderResultHTML` currently builds the portrait hero + 女/男 toggle inline as `portraitHTML`. Extract that into a reusable `renderPortrait(type)` so the gallery detail reuses identical markup/behavior. Behavior must be unchanged for the result screen.

- [ ] **Step 1: Add the `renderPortrait` helper**

Find this block inside `renderResultHTML` (~2485):
```javascript
  const portraitSrc = portraitPath(r.type);
  const g = getGender();
  const portraitHTML = portraitSrc
    ? `<div class="portrait-wrap">
        <img class="type-portrait" src="${portraitSrc}" alt="${escapeHTML(r.type)} — ${escapeHTML(r.nickname_ko)}" width="1024" height="640" loading="eager" decoding="async" data-type="${escapeHTML(r.type)}">
        <div class="gender-toggle" role="group" aria-label="초상 선택">
          <button type="button" data-gender="women" class="${g === "women" ? "active" : ""}" aria-pressed="${g === "women"}">女</button>
          <button type="button" data-gender="men" class="${g === "men" ? "active" : ""}" aria-pressed="${g === "men"}">男</button>
        </div>
      </div>`
    : "";
```

Replace it with a call to a new helper:
```javascript
  const portraitHTML = renderPortrait(r.type, r.nickname_ko);
```

Then add the helper function immediately BEFORE `function renderResultHTML(r) {`:
```javascript
// Portrait hero + 女/男 toggle. Shared by the result screen and the 도감 gallery
// detail so both render identical markup and respond to the same gender toggle.
function renderPortrait(type, altLabel) {
  const src = portraitPath(type);
  if (!src) return "";
  const g = getGender();
  const alt = `${type}${altLabel ? " — " + altLabel : ""}`;
  return `<div class="portrait-wrap">
        <img class="type-portrait" src="${src}" alt="${escapeHTML(alt)}" width="1024" height="640" loading="eager" decoding="async" data-type="${escapeHTML(type)}">
        <div class="gender-toggle" role="group" aria-label="초상 선택">
          <button type="button" data-gender="women" class="${g === "women" ? "active" : ""}" aria-pressed="${g === "women"}">女</button>
          <button type="button" data-gender="men" class="${g === "men" ? "active" : ""}" aria-pressed="${g === "men"}">男</button>
        </div>
      </div>`;
}
```

- [ ] **Step 2: Syntax gate**

Run the syntax gate. Expected: `OK 2 blocks`.

- [ ] **Step 3: Render gate — result screen unchanged**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8000 >/dev/null 2>&1 &
sleep 1 && curl -s "localhost:8000/korean-mbti/" | grep -c "portrait-wrap\|gender-toggle"
kill %1 2>/dev/null
```
Expected: `0` (the markup is JS-generated, not in static HTML) — this just confirms the page still serves 200 without the helper breaking parse. (Real visual check happens in Task 7.)

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: extract renderPortrait() shared helper from result screen"
```

---

## Task 3: Add the gallery tab + empty panel markup

**Files:**
- Modify: `korean-mbti/index.html` — tabs block (~1335) and after `#panel-ai` close (~1387).

- [ ] **Step 1: Add the third tab**

Find:
```html
  <button class="tab" data-mode="ai" role="tab" id="tab-ai" aria-selected="false" aria-controls="panel-ai">
    AI 깊이 읽기
    <span class="meta">Free-text · Claude</span>
  </button>
</div>
```
Insert a new tab button before the closing `</div>`:
```html
  <button class="tab" data-mode="ai" role="tab" id="tab-ai" aria-selected="false" aria-controls="panel-ai">
    AI 깊이 읽기
    <span class="meta">Free-text · Claude</span>
  </button>
  <button class="tab" data-mode="gallery" role="tab" id="tab-gallery" aria-selected="false" aria-controls="panel-gallery">
    16유형 도감
    <span class="meta">16유형 · 초상 도감</span>
  </button>
</div>
```

- [ ] **Step 2: Add the empty panel with two view containers**

Find the closing `</section>` of `#panel-ai` (the AI panel that starts at line ~1389). Immediately after it, insert:
```html
<!-- ====== GALLERY PANEL (16유형 도감) ====== -->
<section class="panel" id="panel-gallery" role="tabpanel" aria-labelledby="tab-gallery">
  <div id="gallery-grid"></div>
  <div id="gallery-detail" style="display:none"></div>
</section>
```

- [ ] **Step 3: Verify the tab-switch handler picks it up (no JS change needed)**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
grep -n 'querySelectorAll\|\$\$(".tab")\|"#panel-" + mode' korean-mbti/index.html | head
```
Expected: confirms the handler at ~2216 uses `$$(".tab")` + `"#panel-" + mode` (generic). No edit required.

- [ ] **Step 4: Render gate — three tabs present, gallery tab switches**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8000 >/dev/null 2>&1 &
sleep 1 && curl -s "localhost:8000/korean-mbti/" | grep -c 'data-mode="gallery"\|id="panel-gallery"'
kill %1 2>/dev/null
```
Expected: `2` (tab button + panel section).

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: add 16유형 도감 tab + empty gallery panel"
```

---

## Task 4: Implement `renderGallery()` (grid view)

**Files:**
- Modify: `korean-mbti/index.html` — add function near the other render functions (after `renderFnStack`, ~2570).

- [ ] **Step 1: Add `renderGallery()`**

Insert after the close of `renderFnStack` (the `}` ending that function, ~2570):
```javascript
// ============================================================
// 16유형 도감 — GALLERY GRID
// Four temperament sections, each tinted with its bible palette.
// Each card: selected-gender portrait + code + short nickname.
// ============================================================
function renderGallery() {
  const sections = TEMPERAMENT_GROUPS.map(group => {
    const cards = group.types.map(type => {
      const meta = TYPES[type] || {};
      const shortNick = (meta.nickname || "").split(" · ")[0] || type;
      const src = portraitPath(type);
      return `
        <button class="type-card" data-type="${type}" aria-label="${escapeHTML(type)} ${escapeHTML(shortNick)}">
          <span class="type-card-thumb">
            <img src="${src}" alt="" width="1024" height="1024" loading="lazy" decoding="async" data-type="${type}">
          </span>
          <span class="type-card-code">${type}</span>
          <span class="type-card-nick">${escapeHTML(shortNick)}</span>
        </button>`;
    }).join("");
    return `
      <section class="temperament-section" style="--group-anchor:${group.anchor}">
        <h3 class="temperament-label">${escapeHTML(group.label)}</h3>
        <div class="type-grid">${cards}</div>
      </section>`;
  }).join("");

  const g = getGender();
  return `
    <div class="gallery-head">
      <div class="gallery-intro">열여섯 결을 한눈에. 카드를 누르면 그 유형의 결이 펼쳐집니다.</div>
      <div class="gender-toggle gallery-gender" role="group" aria-label="초상 선택">
        <button type="button" data-gender="women" class="${g === "women" ? "active" : ""}" aria-pressed="${g === "women"}">女</button>
        <button type="button" data-gender="men" class="${g === "men" ? "active" : ""}" aria-pressed="${g === "men"}">男</button>
      </div>
    </div>
    ${sections}`;
}
```

- [ ] **Step 2: Logic gate — grid builds 16 cards across 4 sections**

Run (mirrors the function's structure against real data shapes):
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const TEMPERAMENT_GROUPS=[{label:"NT · 분석가",anchor:"#ADA7FF",types:["INTJ","INTP","ENTJ","ENTP"]},{label:"NF · 외교관",anchor:"#D96E54",types:["INFJ","INFP","ENFJ","ENFP"]},{label:"SJ · 관리자",anchor:"#9CAA8E",types:["ISTJ","ISFJ","ESTJ","ESFJ"]},{label:"SP · 탐험가",anchor:"#E3B25A",types:["ISTP","ISFP","ESTP","ESFP"]}];
const TYPES={INTJ:{nickname:"전략가 · 마스터플랜의 사람"}}; // sample
const cards=TEMPERAMENT_GROUPS.flatMap(g=>g.types);
const short=(TYPES.INTJ.nickname).split(" · ")[0];
console.log("cards="+cards.length, "sections="+TEMPERAMENT_GROUPS.length, "shortNick="+short);
'
```
Expected: `cards=16 sections=4 shortNick=전략가`

- [ ] **Step 3: Syntax gate**

Run the syntax gate. Expected: `OK 2 blocks`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: add renderGallery() grid view"
```

---

## Task 5: Implement `renderGalleryDetail()` (detail view)

**Files:**
- Modify: `korean-mbti/index.html` — add function after `renderGallery` (~2600).

**Context:** Reuses `renderPortrait()` (Task 2) and `renderFnStack()` (existing). Replaces the 4축 bars with the explanatory note. Note text and test link are exact.

- [ ] **Step 1: Add `renderGalleryDetail(type)`**

Insert after the close of `renderGallery`:
```javascript
// ============================================================
// 16유형 도감 — DETAIL (result-style, minus 4축 bars)
// ============================================================
function renderGalleryDetail(type) {
  const meta = TYPES[type] || {};
  const portraitHTML = renderPortrait(type, (meta.nickname || "").split(" · ")[0]);
  const vibesHTML = (meta.vibes || []).map(v => `<span class="vibe">${escapeHTML(v)}</span>`).join("");
  const fnHTML = renderFnStack(type);
  return `
    <button class="gallery-back" data-action="gallery-back">← 도감</button>
    <div class="result">
      ${portraitHTML}
      <div class="type-hero">
        <div class="code">${escapeHTML(type)}</div>
        <div class="nickname">${escapeHTML(meta.nickname || "")}</div>
      </div>
      <p class="gallery-oneliner">${escapeHTML(meta.one_liner || "")}</p>
      ${vibesHTML ? `<div class="vibes">${vibesHTML}</div>` : ""}
      <p class="gallery-note">4축 막대는 ‘내’ 검사 결과에서만 나타나요 — 여기선 유형 고유의 결만 봅니다. <a href="#" data-action="goto-test">내 축이 궁금하다면 → 빠른 테스트</a></p>
      ${fnHTML}
    </div>`;
}
```

- [ ] **Step 2: Verify `.type-hero`, `.code`, `.nickname`, `.vibe` classes already exist (reuse, no new CSS needed for these)**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
grep -c '\.type-hero\|\.type-hero .nickname\|\.vibe\b\|\.code\b' korean-mbti/index.html
```
Expected: `≥3` (these classes are defined for the result screen; gallery reuses them).

- [ ] **Step 3: Syntax gate**

Run the syntax gate. Expected: `OK 2 blocks`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: add renderGalleryDetail() with 4축-replacement note"
```

---

## Task 6: Wire interactions (init, card click, back, test-link, gender sync)

**Files:**
- Modify: `korean-mbti/index.html` — near the tab-switch handler (~2216) and the existing delegated click handlers.

**Context:** Four behaviors. (a) Render the grid into `#gallery-grid` on load. (b) Card click → show detail. (c) `← 도감` back → show grid. (d) test-link → switch to test tab. Plus the existing `[data-gender]` handler must re-render the gallery so its portraits flip. First inspect the existing gender handler so we extend it rather than duplicate.

- [ ] **Step 1: Find the existing gender-toggle handler**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
grep -n 'data-gender\|setGender\|localStorage.setItem.*gender\|vibe.korean-mbti.gender\|getGender' korean-mbti/index.html | head
```
Expected: shows `getGender()` (~2169) and a click handler reading `data-gender`. Note its exact location and how it persists + re-renders. (If it's a delegated document/body listener, our new toggles already work for persistence; we only need to add gallery re-render.)

- [ ] **Step 2: Add gallery init + delegated handlers**

Find the tab-handler block (~2216):
```javascript
$$(".tab").forEach(tab => {
```
Immediately BEFORE that line, insert the init + a delegated click handler scoped to the gallery panel:
```javascript
// ----- 16유형 도감 gallery -----
function showGalleryGrid() {
  $("#gallery-grid").innerHTML = renderGallery();
  $("#gallery-grid").style.display = "";
  $("#gallery-detail").style.display = "none";
}
function showGalleryDetail(type) {
  $("#gallery-detail").innerHTML = renderGalleryDetail(type);
  $("#gallery-detail").style.display = "";
  $("#gallery-grid").style.display = "none";
  $("#panel-gallery").scrollIntoView({ behavior: "smooth", block: "start" });
}
// Initial grid render.
showGalleryGrid();
// Delegated clicks within the gallery panel.
$("#panel-gallery").addEventListener("click", (e) => {
  const card = e.target.closest(".type-card");
  if (card) { showGalleryDetail(card.dataset.type); return; }
  if (e.target.closest('[data-action="gallery-back"]')) { showGalleryGrid(); return; }
  const gotoTest = e.target.closest('[data-action="goto-test"]');
  if (gotoTest) {
    e.preventDefault();
    $('#tab-test').click();
    return;
  }
});
```

- [ ] **Step 3: Make the gender toggle re-render the gallery**

Locate the existing `[data-gender]` click handler found in Step 1. It currently updates `getGender()`'s store and re-renders the result portrait. Add a gallery refresh so the grid + open detail flip too. If the handler is a single delegated listener, append inside it (after it persists the new gender):
```javascript
    // Keep the 도감 gallery portraits in sync with the gender toggle.
    if ($("#panel-gallery")) {
      if ($("#gallery-grid").style.display !== "none") {
        showGalleryGrid();
      } else if ($("#gallery-detail").querySelector(".result")) {
        const t = $("#gallery-detail").querySelector(".type-portrait")?.dataset.type;
        if (t) showGalleryDetail(t);
      }
    }
```
If instead the gender handler is bound per-button inside `renderResultHTML` only (not delegated), add a delegated document-level listener right after the gallery handler from Step 2 to cover the gallery's own toggles:
```javascript
// Gallery's own 女/男 toggles share the global gender store; re-render on change.
$("#panel-gallery").addEventListener("click", (e) => {
  const gbtn = e.target.closest("[data-gender]");
  if (!gbtn) return;
  setGenderAndPersist(gbtn.dataset.gender); // use whatever the existing persist fn is
  if ($("#gallery-grid").style.display !== "none") showGalleryGrid();
  else {
    const t = $("#gallery-detail").querySelector(".type-portrait")?.dataset.type;
    if (t) showGalleryDetail(t);
  }
});
```
**Implementer note:** Use the ACTUAL persistence function/name discovered in Step 1 (e.g. it may set `localStorage` directly). Do not invent `setGenderAndPersist` if a real one exists — match the existing code. The goal: clicking 女/男 anywhere updates the shared store AND re-renders whatever gallery view is visible.

- [ ] **Step 4: Syntax gate**

Run the syntax gate. Expected: `OK 2 blocks`.

- [ ] **Step 5: Render gate — full interaction smoke test**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8000 >/dev/null 2>&1 &
sleep 1
echo "--- gallery grid renders into panel on load (check for cards in served... no, JS-built). Confirm 200 + no console errors manually. ---"
curl -s -o /dev/null -w "%{http_code}\n" "localhost:8000/korean-mbti/"
kill %1 2>/dev/null
```
Expected: `200`. Then **manual browser check** (open `localhost:8000/korean-mbti/`):
- Click `16유형 도감` tab → four tinted sections, 16 cards with portraits.
- Click a card → detail with portrait, nickname, one-liner, vibes, note, function stack (NO 4축 bars).
- Click `← 도감` → back to grid.
- Click the note's `→ 빠른 테스트` link → switches to the test tab.
- Flip 女/男 in the gallery → all card portraits change; flip on result screen → gallery matches.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: wire gallery — grid init, card→detail, back, test-link, gender sync"
```

---

## Task 7: Gallery CSS

**Files:**
- Modify: `korean-mbti/index.html` — add a CSS block near the `.fnstack` styles (~870, after the function-stack CSS region).

**Context:** Match the editorial grammar — cream paper, JetBrains Mono labels, celadon accents, the existing `.fnstack-grid` responsive breakpoint. Reuse `--group-anchor` set inline per section (Task 4).

- [ ] **Step 1: Add the gallery stylesheet block**

Find the end of the function-stack CSS (the `@media` block containing `.fnstack-grid { grid-template-columns: repeat(2, 1fr); ... }`, ~873). Insert after its closing `}`:
```css
/* ---------- 16유형 도감 (gallery) ---------- */
.gallery-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.gallery-intro {
  font-family: "Noto Serif KR", serif;
  font-style: italic;
  font-size: 13px;
  color: rgba(31, 38, 32, 0.6);
}
.temperament-section {
  margin-bottom: 26px;
  padding: 18px 18px 20px;
  border-radius: 6px;
  /* faint wash of the group anchor over cream */
  background:
    linear-gradient(0deg, color-mix(in srgb, var(--group-anchor) 7%, transparent), color-mix(in srgb, var(--group-anchor) 7%, transparent)),
    rgba(31, 38, 32, 0.015);
  border: 1px solid color-mix(in srgb, var(--group-anchor) 22%, var(--line));
}
.temperament-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--group-anchor) 60%, var(--ink));
  margin-bottom: 14px;
  font-weight: 500;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--paper);
  cursor: pointer;
  overflow: hidden;
  font-family: inherit;
  transition: border-color 0.18s, transform 0.12s, box-shadow 0.18s;
}
.type-card:hover,
.type-card:focus-visible {
  border-color: var(--accent-2);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(31, 38, 32, 0.1);
  outline: none;
}
.type-card-thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: rgba(31, 38, 32, 0.04);
}
.type-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  display: block;
}
.type-card-code {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--gold);
  margin-top: 10px;
}
.type-card-nick {
  font-family: "Noto Sans KR", sans-serif;
  font-size: 12px;
  color: rgba(31, 38, 32, 0.72);
  margin-top: 3px;
  text-align: center;
  padding: 0 6px;
}
.gallery-back {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--accent-2);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 14px;
}
.gallery-back:hover { color: var(--accent); }
.gallery-oneliner {
  font-family: "Noto Serif KR", serif;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
  margin: 4px 0 12px;
}
.gallery-note {
  font-family: "Noto Serif KR", serif;
  font-style: italic;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(31, 38, 32, 0.55);
  margin: 6px 0 20px;
}
.gallery-note a {
  color: var(--accent-2);
  font-style: normal;
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent-2) 40%, transparent);
}
.gallery-note a:hover { color: var(--accent); }
@media (max-width: 560px) {
  .type-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .type-card { transition: none; }
  .type-card:hover, .type-card:focus-visible { transform: none; }
}
```

- [ ] **Step 2: Verify `--accent`, `--accent-2`, `--gold`, `--line`, `--paper`, `--ink` CSS vars exist**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
grep -c -- '--accent-2:\|--accent:\|--gold:\|--line:\|--paper:\|--ink:' korean-mbti/index.html
```
Expected: `≥6` (all referenced vars are defined in `:root`).

- [ ] **Step 3: Verify `color-mix` fallback acceptable**

`color-mix()` is supported in all current evergreen browsers (Chrome/Edge/Safari/Firefox 2023+). Acceptable for a demo. No action — just confirm awareness.

- [ ] **Step 4: Render gate — visual polish check (manual)**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8000 >/dev/null 2>&1 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" "localhost:8000/korean-mbti/"
kill %1 2>/dev/null
```
Expected: `200`. Manual browser check: four sections each have a faint distinct tint (lavender/coral/sage/honey), cards lift on hover, portraits crop cleanly, 2-col on a narrow window, detail note reads as subtle italic with a celadon link.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/index.html
git commit -m "korean-mbti: gallery CSS — tinted temperament sections, portrait cards, note"
```

---

## Task 8: Service worker cache bump + final verification

**Files:**
- Modify: `korean-mbti/sw.js:1` — cache version.

- [ ] **Step 1: Bump the cache version**

In `korean-mbti/sw.js`, change line 1:
```javascript
const CACHE = "vibe-korean-mbti-v11";
```
to:
```javascript
const CACHE = "vibe-korean-mbti-v12";
```

- [ ] **Step 2: Final syntax gate + serve check**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
node -e 'const fs=require("fs");const h=fs.readFileSync("korean-mbti/index.html","utf8");const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];let ok=true;m.forEach((s,i)=>{try{new Function(s[1])}catch(e){ok=false;console.log("Block "+i+" ERROR:",e.message)}});console.log(ok?"OK "+m.length+" blocks":"FAILED")'
python3 -m http.server 8000 >/dev/null 2>&1 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" "localhost:8000/korean-mbti/"
kill %1 2>/dev/null
```
Expected: `OK 2 blocks` then `200`.

- [ ] **Step 3: Confirm tinywings still untouched**

Run:
```bash
git -C /home/ubuntu/projects/vibe-demos status --short
```
Expected: ` M tinywings/index.html` and ` M tinywings/sw.js` still present and unstaged; no korean-mbti files dirty after this commit.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add korean-mbti/sw.js
git commit -m "korean-mbti: bump SW cache v11 → v12 for gallery tab"
```

---

## Task 9: Deploy decision (STOP — ask user)

**Do not auto-merge.** The gallery work lives on whatever branch is current. Per repo convention, deploy = merge to `main` and push.

- [ ] **Step 1: Show the user the commit range and ask**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
git log --oneline -10
git branch --show-current
```

- [ ] **Step 2: Ask the user**: merge to `main` + push (deploys to Pages), open a PR, or leave on the branch. Also remind them their `tinywings` working-tree changes (incl. the `__TW_DEBUG_G` debug hook) are still uncommitted and untouched. Follow their instruction; if merging, mirror the earlier safe-merge approach (rebuild on latest `origin/main`, never force-push).

---

## Self-review

**Spec coverage:**
- Third tab `16유형 도감` → Task 3. ✓
- Two views (grid/detail) → Tasks 4, 5, wired in 6. ✓
- Grouped + tinted temperament sections → Task 1 (data) + Task 4 (render) + Task 7 (CSS). ✓
- Single portrait per card, global 女/男 toggle, sync across grid/detail/result → Task 4 (toggle in head), Task 6 Step 3 (sync). ✓
- Detail = result layout minus 4축, with note + test link → Task 5. ✓
- `renderPortrait` extraction (DRY) → Task 2. ✓
- Reuse `renderFnStack` (already #1→#4 sorted) → Task 5. ✓
- SW bump v11→v12 → Task 8. ✓
- No new images / no AI / no deps → respected throughout. ✓
- Pending clarity work committed first, tinywings untouched → Task 0 + Task 8 Step 3 + Task 9 Step 2. ✓

**Placeholder scan:** Task 6 Step 3 intentionally references "the ACTUAL persistence function discovered in Step 1" — this is a deliberate discover-then-match instruction, not a placeholder, because the existing gender-persist mechanism must be read from the live code rather than assumed. Both branches (delegated vs per-button) are specified with complete code. No other placeholders.

**Type/name consistency:** `renderPortrait(type, altLabel)`, `renderGallery()`, `renderGalleryDetail(type)`, `showGalleryGrid()`, `showGalleryDetail(type)`, `TEMPERAMENT_GROUPS`, data-actions `gallery-back` / `goto-test` — all used consistently across tasks. Detail markup reuses existing `.type-hero`/`.code`/`.nickname`/`.vibe`/`.result` classes (verified present in Task 5 Step 2).

**Scope:** Single file + SW bump, one cohesive feature. Fits one plan.
