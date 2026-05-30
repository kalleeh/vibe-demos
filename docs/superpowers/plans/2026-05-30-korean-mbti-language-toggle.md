# Full-Page EN/KO Language Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header KO/EN toggle that switches the entire `korean-mbti` demo — UI chrome, 93-question test, 16-type gallery, result screen, AND the AI deep-read mode (English prompt, canned outputs, samples) — between Korean and English live, default Korean, persisted, preserving state.

**Architecture:** Approach A — a centralized `STR = {ko, en}` dictionary for fixed UI strings plus paired `_ko`/`_en` fields on existing data objects, read through `t(key)` and `L(obj, field)` helpers that fall back to Korean (never blank). A header toggle flips a module-level `LANG`, re-applies static `[data-i18n]` chrome, and re-renders the active JS panel. AI mode selects `SYS_EN` vs `SYS_KO`.

**Tech Stack:** Plain HTML/CSS/vanilla JS, single self-contained file `korean-mbti/index.html` (+ `sw.js`). No build, no framework, no fetch, no test runner.

---

## Testing approach (read first)

No test framework (static demo, by design). Verification = deterministic commands:

- **Syntax gate** (after every JS change):
  ```bash
  cd /home/ubuntu/projects/vibe-demos
  node -e 'const fs=require("fs");const h=fs.readFileSync("korean-mbti/index.html","utf8");const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];let ok=true;m.forEach((s,i)=>{try{new Function(s[1])}catch(e){ok=false;console.log("Block "+i+" ERROR:",e.message)}});console.log(ok?"OK "+m.length+" blocks":"FAILED")'
  ```
  Expected: `OK 2 blocks`
- **Logic gate** for helpers: extract into a node snippet, assert output (shown per task).
- **No-Korean-remaining gate** for EN content tasks: a node check that walks the relevant `_en` fields and asserts none contain Hangul (regex `[가-힣]`).
- **Render gate:** `python3 -m http.server 8020 -d /home/ubuntu/projects/vibe-demos` → open `localhost:8020/korean-mbti/`, manual check.

Run all commands from repo root `/home/ubuntu/projects/vibe-demos`.

**Branch first:** This work must NOT happen on `main`. Task 0 creates a feature branch.

---

## Exact anchors in current file (verified)

| Symbol | Line |
|---|---|
| `FACETS` | 1626 |
| `QUESTIONS_FULL` | 1658 |
| `AXIS_LABELS` | 1971 |
| `TYPES` | 1980 |
| `DIAL_BUCKETS` | 2058 |
| `TEMPERAMENT_GROUPS` | 2068 |
| `FN_RANK_LABEL` | 2104 |
| `CANNED` | 2118 |
| `GENDER_STORAGE` / `getGender` / `setGender` | 2328 / 2330 / 2334 |
| `showGalleryGrid` / `showGalleryDetail` | 2364 / 2369 |
| `renderQuestion` | 2448 |
| `wireGenderToggle($("#test-result"))` | 2626 |
| `renderResultHTML` | 2667 |
| `renderFnStack` | 2746 |
| `renderGallery` | 2804 |
| `renderGalleryDetail` | 2841 |
| `wireGenderToggle` def | 2902 |
| `SAMPLES` | 3158 |
| `wireGenderToggle($("#ai-result"))` | 3363 |
| `const sys = ` (AI prompt) | 3402 |

(Line numbers drift as tasks add code; always re-`grep` before editing.)

## Canonical fixed values (use verbatim)

**16 EN nicknames = standard archetype titles** (per locked decision):
```
INTJ The Architect      INTP The Logician     ENTJ The Commander    ENTP The Debater
INFJ The Advocate       INFP The Mediator     ENFJ The Protagonist  ENFP The Campaigner
ISTJ The Logistician    ISFJ The Defender     ESTJ The Executive    ESFJ The Consul
ISTP The Virtuoso       ISFP The Adventurer    ESTP The Entrepreneur ESFP The Entertainer
```

**EN axis labels** (for `STR`): EI → "E · Extraversion" / "I · Introversion"; SN → "S · Sensing" / "N · Intuition"; TF → "T · Thinking" / "F · Feeling"; JP → "J · Judging" / "P · Perceiving".

**EN facet poles** (20, for `FACETS` `_en`): ER Initiating/Receiving · EC Expressive/Contained · GI Gregarious/Intimate · AR Active/Reflective · EQ Enthusiastic/Quiet · CA Concrete/Abstract · RI Realistic/Imaginative · PC Practical/Conceptual · ET Experiential/Theoretical · TO Traditional/Original · LE Logical/Empathetic · RC Reasonable/Compassionate · QA Questioning/Accommodating · CR Critical/Receptive(Accepting) · TT Tough/Tender · SO Systematic/Casual · PL Planful/Open-ended · ES Early-starting/Pressure-prompted · SC Scheduled/Spontaneous · MM Methodical/Emergent. (If a facet code here is absent in the file, skip it; if the file has a code not listed, translate by its Korean poles.)

**EN function buckets** (`DIAL_BUCKETS` `label_en`): T 思 Thinking · F 感 Feeling · N 直 Intuition · S 覺 Sensing. **EN rank labels** (`FN_RANK_LABEL`): 1 Dominant · 2 Auxiliary · 3 Tertiary · 4 Inferior · 5 Off-stack. **EN temperament labels** (`TEMPERAMENT_GROUPS`): NT Analysts · NF Diplomats · SJ Sentinels · SP Explorers.

---

## Task 0: Branch from main

**Files:** none (git only).

- [ ] **Step 1: Confirm clean tree on main**

```bash
cd /home/ubuntu/projects/vibe-demos
git branch --show-current && git status --short
```
Expected: `main` and a clean (empty) status. If dirty, STOP and report.

- [ ] **Step 2: Create the feature branch**

```bash
cd /home/ubuntu/projects/vibe-demos
git checkout -b korean-mbti-lang-toggle
git branch --show-current
```
Expected: `korean-mbti-lang-toggle`.

---

## Task 1: i18n core — `STR` skeleton + `LANG` + `t()` + `L()`

**Files:** Modify `korean-mbti/index.html` — insert near the top of the main `<script>`, BEFORE `const FACETS` (line ~1626). Find the first `<script>` that contains `const FACETS` and insert just inside it / just before that const.

- [ ] **Step 1: Insert the i18n core**

Immediately before `const FACETS = {` insert:
```javascript
// ============================================================
// i18n core — paired _ko/_en data + STR dictionary, KO fallback.
// ============================================================
const LANG_STORAGE = "vibe.korean-mbti.lang";
let LANG = (localStorage.getItem(LANG_STORAGE) === "en") ? "en" : "ko"; // default ko
function setLangValue(l) { LANG = (l === "en") ? "en" : "ko"; localStorage.setItem(LANG_STORAGE, LANG); }
// Fixed-UI string lookup: current lang → ko fallback → key itself.
const t = (key) => (STR[LANG] && STR[LANG][key] != null ? STR[LANG][key] : (STR.ko[key] != null ? STR.ko[key] : key));
// Paired-field picker for data objects: field_<lang> → field_ko → field.
const L = (obj, field) => {
  if (!obj) return "";
  const v = obj[field + "_" + LANG];
  if (v != null) return v;
  const ko = obj[field + "_ko"];
  if (ko != null) return ko;
  return obj[field] != null ? obj[field] : "";
};
// STR is populated in the next task; define empty shells so t() never throws.
const STR = { ko: {}, en: {} };
```

- [ ] **Step 2: Syntax gate** → Expected `OK 2 blocks`.

- [ ] **Step 3: Logic gate**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
let LANG="ko"; const STR={ko:{a:"가"},en:{a:"A"}};
const t=(k)=>(STR[LANG]&&STR[LANG][k]!=null?STR[LANG][k]:(STR.ko[k]!=null?STR.ko[k]:k));
const L=(o,f)=>{if(!o)return"";const v=o[f+"_"+LANG];if(v!=null)return v;const ko=o[f+"_ko"];if(ko!=null)return ko;return o[f]!=null?o[f]:"";};
console.log(t("a"), t("missing")); LANG="en"; console.log(t("a"));
const o={n_ko:"가",n_en:"A"}; console.log(L(o,"n")); LANG="ko"; console.log(L(o,"n"));
const p={n_ko:"가"}; LANG="en"; console.log(L(p,"n")); // en missing → ko fallback
'
```
Expected: `가 missing` then `A` then `A` then `가` then `가`.

- [ ] **Step 4: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: i18n core — LANG, STR shell, t()/L() helpers with KO fallback"
```

---

## Task 2: Populate `STR` with all fixed-UI strings (KO + EN)

**Files:** Modify `korean-mbti/index.html` — replace the `const STR = { ko: {}, en: {} };` shell from Task 1 with the full dictionary.

**Context:** This holds every fixed UI label that is NOT per-type data. Keys grouped by area. EN values use natural product English. KO values must EXACTLY match the current on-screen Korean (so KO mode is unchanged). Some values contain inline `<em>` markup (title, subtitles) — these are applied via innerHTML (whitelisted in Task 5).

- [ ] **Step 1: Replace the STR shell with the full dictionary**

Replace `const STR = { ko: {}, en: {} };` with the block below. (KO strings are sourced verbatim from the current markup/render code; EN are the translations.)
```javascript
const STR = {
  ko: {
    titleHTML: "MBTI · 성격의 <em>결</em>",
    sub: "짧은 검사로 16유형을 읽고, 내 결을 들여다보는 시간.",
    backLink: "← 인덱스",
    tabTest: "빠른 테스트", tabTestMeta: "28문항 · 약 5분 · 빠른 진단",
    tabAI: "AI 깊이 읽기", tabAIMeta: "Free-text · Claude",
    tabGallery: "16유형 도감", tabGalleryMeta: "16유형 · 초상 도감",
    introH: "두 가지 길이로 풀 수 있어요",
    lenQuickLabel: "빠른 인상", lenQuickMeta: "~5분 · 7문항/축", lenQuickCta: "시작 →",
    lenFullLabel: "정밀 · Form M 길이", lenFullMeta: "~15분 · 21·26·24·22 분포", lenFullCta: "시작 →",
    aiH: "당신의 글을 읽고 유형을 추론합니다",
    hintGoodH: "잘 읽히는 글", hintBadH: "덜 읽히는 글",
    placeholder: "여기에 200~600자 정도의 한국어 글을 붙여넣어 주세요. 위 예시 칩을 눌러서 시작해도 됩니다.",
    sampleDiary: "일기 (몽글 INFP풍)", sampleKakao: "카톡 (인싸 ENFP풍)", sampleReflect: "자기성찰 (조용 INTJ풍)", sampleClear: "비우기",
    micLabel: "말하기", keyBtn: "키 입력 / 해제", readBtn: "읽어줘 →",
    modeDemoPill: "데모 모드", modeLivePill: "실시간 모드",
    keyPanelH: "본인의 Anthropic API 키를 사용합니다",
    keyPanelP: "키는 이 브라우저의 localStorage에만 저장되며 어디로도 전송되지 않습니다.",
    keyPaste: "붙여넣기", keySave: "저장", keyForget: "잊기",
    stageReading: "분석 중 — 글의 결을 읽는 중…",
    footerTag: "MBTI는 가벼운 자기 이해 도구. 진단 아님.",
    galleryIntro: "열여섯 결을 한눈에. 카드를 누르면 그 유형의 결이 펼쳐집니다.",
    galleryBack: "← 도감",
    galleryNoteHTML: "4축 막대는 ‘내’ 검사 결과에서만 나타나요 — 여기선 유형 고유의 결만 봅니다. ",
    galleryNoteLink: "내 축이 궁금하다면 → 빠른 테스트",
    axesHeading: "4 축 분석",
    axesSubHTML: "유형을 이루는 <em>네 글자</em> — 각 축에서 어느 쪽에 섰는지와 그 확신도.",
    readingHeading: "읽어드린 결",
    fnStackHeading: "인지 기능 스택 — Function Stack",
    fnStackSubHTML: "같은 성향을 <em>쓰는 순서</em>로 — 가장 기대는 결(#1)부터 가장 서툰 결(#4)까지.",
    fnOffStackTip: "이 유형의 기본 스택에는 없는 결.",
    saveCardBtn: "결과 카드 저장", cardSaving: "그리는 중…", cardSaved: "저장됨 ✓", cardFailed: "저장 실패",
    navBack: "← 이전", navNext: "다음 →", navSeeResult: "결과 보기 →",
    secondaryLabel: "2순위",
    pillFull: "93-Q FORM-M LENGTH", pillQuick: "28-Q QUICK", pillDemo: "DEMO",
    errClipboard: "클립보드 읽기를 허용해 주세요.", errNoKey: "키를 입력해 주세요.",
    errTooShort: "조금 더 길게 적어주세요. 200자 이상이 가장 정확합니다.",
    errKeyRejected: "키가 거부되었습니다. 다시 입력해 주세요.", errGeneric: "오류가 발생했습니다.",
    hintShort: "한 단락 정도 적어주세요", hintMin: "조금 더 길게 — 80자 이상부터 가능",
    hintMore: "200자 이상이면 더 정확해져요", hintGood: "좋아요, 읽기 좋은 길이", hintLong: "꽤 길어요 — 600자 안쪽이 가장 잘 읽혀요",
    micUnsupportedTitle: "이 브라우저는 음성 입력을 지원하지 않아요", micUnsupportedLabel: "음성 미지원",
    micStartFail: "마이크를 시작할 수 없어요 — 권한을 확인해 주세요", micListening: "듣는 중 — 말씀하시면 화면에 받아 적어요",
    micDenied: "마이크 권한이 거부되었어요 — 브라우저 설정에서 허용해 주세요", micNoSound: "들리는 소리가 없어요 — 가까이서 말씀해 주세요",
    micNotFound: "마이크를 찾을 수 없어요", micNetwork: "네트워크 오류로 음성 인식이 멈췄어요",
    counterSuffix: "자"
  },
  en: {
    titleHTML: "MBTI · the <em>grain</em> of you",
    sub: "A short test reads your 16-type grain — a moment to look inward.",
    backLink: "← Index",
    tabTest: "Quick Test", tabTestMeta: "28 items · ~5 min · fast read",
    tabAI: "AI Deep Read", tabAIMeta: "Free-text · Claude",
    tabGallery: "16 Types", tabGalleryMeta: "16 types · portrait index",
    introH: "Two lengths to choose from",
    lenQuickLabel: "Quick impression", lenQuickMeta: "~5 min · 7 items/axis", lenQuickCta: "Start →",
    lenFullLabel: "Precise · Form M length", lenFullMeta: "~15 min · 21·26·24·22 split", lenFullCta: "Start →",
    aiH: "It reads your writing and infers your type",
    hintGoodH: "Reads well", hintBadH: "Reads poorly",
    placeholder: "Paste about 200–600 characters of your own writing here. You can also tap a sample chip above to start.",
    sampleDiary: "Diary (cozy INFP)", sampleKakao: "Chat (social ENFP)", sampleReflect: "Reflection (quiet INTJ)", sampleClear: "Clear",
    micLabel: "Speak", keyBtn: "Enter / clear key", readBtn: "Read me →",
    modeDemoPill: "Demo mode", modeLivePill: "Live mode",
    keyPanelH: "Use your own Anthropic API key",
    keyPanelP: "Your key is stored only in this browser's localStorage and is never sent anywhere else.",
    keyPaste: "Paste", keySave: "Save", keyForget: "Forget",
    stageReading: "Analyzing — reading the grain of your text…",
    footerTag: "MBTI is a light self-understanding tool. Not a diagnosis.",
    galleryIntro: "All sixteen at a glance. Tap a card to open that type's grain.",
    galleryBack: "← Types",
    galleryNoteHTML: "The 4-axis bars only appear for ‘your’ test result — here you see the type's own grain. ",
    galleryNoteLink: "Curious about your axes? → Quick Test",
    axesHeading: "4-Axis Analysis",
    axesSubHTML: "The <em>four letters</em> that form your type — which side of each axis, and how sure.",
    readingHeading: "Your reading",
    fnStackHeading: "Cognitive Function Stack",
    fnStackSubHTML: "The same traits in <em>order of use</em> — from the one you lean on most (#1) to the clumsiest (#4).",
    fnOffStackTip: "Not part of this type's core stack.",
    saveCardBtn: "Save result card", cardSaving: "Drawing…", cardSaved: "Saved ✓", cardFailed: "Save failed",
    navBack: "← Back", navNext: "Next →", navSeeResult: "See result →",
    secondaryLabel: "Runner-up",
    pillFull: "93-Q FORM-M LENGTH", pillQuick: "28-Q QUICK", pillDemo: "DEMO",
    errClipboard: "Please allow clipboard access.", errNoKey: "Please enter your key.",
    errTooShort: "Please write a bit more — 200+ characters reads most accurately.",
    errKeyRejected: "Key was rejected. Please re-enter it.", errGeneric: "Something went wrong.",
    hintShort: "About one paragraph, please", hintMin: "A little longer — 80+ characters to begin",
    hintMore: "200+ characters reads more accurately", hintGood: "Good — a comfortable length", hintLong: "Quite long — under 600 characters reads best",
    micUnsupportedTitle: "This browser doesn't support voice input", micUnsupportedLabel: "No voice support",
    micStartFail: "Couldn't start the mic — check permissions", micListening: "Listening — speak and it transcribes here",
    micDenied: "Mic permission denied — allow it in browser settings", micNoSound: "No sound detected — please speak closer",
    micNotFound: "No microphone found", micNetwork: "Voice recognition stopped due to a network error",
    counterSuffix: " chars"
  }
};
```

- [ ] **Step 2: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 3: Parity gate — ko and en have identical key sets**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const h=require("fs").readFileSync("korean-mbti/index.html","utf8");
const m=h.match(/const STR = \{[\s\S]*?\n\};/); const STR=eval("("+m[0].replace("const STR = ","")+")");
const ko=Object.keys(STR.ko).sort(), en=Object.keys(STR.en).sort();
const miss=ko.filter(k=>!STR.en[k]&&STR.en[k]!==""), extra=en.filter(k=>!(k in STR.ko));
console.log("ko keys="+ko.length, "en keys="+en.length, "missing in en="+JSON.stringify(miss), "extra in en="+JSON.stringify(extra));
'
```
Expected: equal counts, `missing in en=[]`, `extra in en=[]`.

- [ ] **Step 4: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: populate STR dictionary (all fixed UI strings, KO+EN)"
```

---

## Task 3: Tag static HTML chrome with `data-i18n` + add `applyStaticStrings()`

**Files:** Modify `korean-mbti/index.html` — the static markup regions (header ~1450, tabs ~1459, intro ~1478, AI panel ~1524, key panel ~1584, footer ~1611) and add a function near the other top-level wiring.

- [ ] **Step 1: Add `data-i18n` / `data-i18n-attr` to each static Korean node**

For every fixed Korean string in the static markup, add `data-i18n="<key>"` to its element (text nodes) or `data-i18n-attr="placeholder:placeholder"` etc. for attributes. Use the keys from Task 2. Examples (apply the same pattern to ALL static chrome listed in the spec inventory §1):
- `<div class="sub" data-i18n="sub">짧은 검사로…</div>`
- tab button label spans: wrap the label text in a span `<span data-i18n="tabTest">빠른 테스트</span>` and the meta `<span class="meta" data-i18n="tabTestMeta">…</span>`
- title (has `<em>`): `<h1 class="title" data-i18n-html="titleHTML">MBTI · 성격의 <em>결</em></h1>`
- textarea: `<textarea … data-i18n-attr="placeholder:placeholder">`
- footer tagline, key panel h3/p, all buttons (붙여넣기/저장/잊기 → keyPaste/keySave/keyForget), chips, mic label, read button, etc.

Use three attribute hooks:
- `data-i18n="KEY"` → sets `textContent = t(KEY)`.
- `data-i18n-html="KEY"` → sets `innerHTML = t(KEY)` (ONLY for the whitelisted markup keys: titleHTML; subtitles are render-generated, not static).
- `data-i18n-attr="attr:KEY[,attr2:KEY2]"` → sets each attribute to `t(KEY)`.

- [ ] **Step 2: Add `applyStaticStrings()`**

Insert near the top-level init code (before the tab-handler `$$(".tab").forEach`, find it via `grep -n '\$\$(".tab").forEach'`):
```javascript
// Swap all tagged static-chrome strings to the current LANG.
function applyStaticStrings() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    el.getAttribute("data-i18n-attr").split(",").forEach(pair => {
      const [attr, key] = pair.split(":").map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}
```

- [ ] **Step 3: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 4: Verify every key referenced by markup exists in STR**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const h=require("fs").readFileSync("korean-mbti/index.html","utf8");
const STR=eval("("+h.match(/const STR = \{[\s\S]*?\n\};/)[0].replace("const STR = ","")+")");
const keys=new Set([...h.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map(m=>m[1]));
const attrKeys=[...h.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m=>m[1].split(",").map(p=>p.split(":")[1].trim()));
[...attrKeys].forEach(k=>keys.add(k));
const missing=[...keys].filter(k=>!(k in STR.ko));
console.log("referenced keys="+keys.size, "missing from STR.ko="+JSON.stringify(missing));
'
```
Expected: `missing from STR.ko=[]`.

- [ ] **Step 5: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: tag static chrome with data-i18n + applyStaticStrings()"
```

---

## Task 4: The toggle UI + `setLang()` + load-time apply

**Files:** Modify `korean-mbti/index.html` — header markup (~1450, near `.back-link`), CSS (near `.gender-toggle` rules), and the init/tab-handler region.

- [ ] **Step 1: Add the toggle markup in the header**

Find the `.back-link` (`← 인덱스`) in the header. Immediately before it, add:
```html
<div class="lang-toggle" role="group" aria-label="Language">
  <button type="button" data-lang="ko" aria-pressed="true">KO</button>
  <button type="button" data-lang="en" aria-pressed="false">EN</button>
</div>
```

- [ ] **Step 2: Add CSS** (find the `.gender-toggle` rule block; insert a sibling after it)
```css
.lang-toggle { display: inline-flex; gap: 2px; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; vertical-align: middle; margin-right: 12px; }
.lang-toggle button { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.08em; padding: 4px 9px; background: none; border: none; color: rgba(31,38,32,0.5); cursor: pointer; }
.lang-toggle button.active { background: var(--accent-2); color: var(--paper); }
```

- [ ] **Step 3: Add `setLang()`, `syncLangToggle()`, delegated handler, and load-time apply**

Insert near `applyStaticStrings` (added in Task 3):
```javascript
function syncLangToggle() {
  document.querySelectorAll(".lang-toggle button").forEach(b => {
    const on = b.dataset.lang === LANG;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
function setLang(l) {
  const next = (l === "en") ? "en" : "ko";
  if (next === LANG) return;
  setLangValue(next);
  document.documentElement.lang = LANG;
  syncLangToggle();
  applyStaticStrings();
  rerenderActivePanel();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".lang-toggle button");
  if (b) setLang(b.dataset.lang);
});
```

- [ ] **Step 4: Wire load-time apply.** Find where the gallery is first rendered / the init runs (the `showGalleryGrid();` call added by the gallery feature, and the tab handler). Add, right after the gallery init line, a one-time language apply:
```javascript
// Apply persisted language on load.
document.documentElement.lang = LANG;
syncLangToggle();
applyStaticStrings();
```
(`rerenderActivePanel` is defined in Task 6; until then this references it only inside `setLang`, which isn't called at load, so syntax is fine. If the syntax gate complains about `rerenderActivePanel` being undefined, it will NOT — `new Function` doesn't resolve free identifiers. Proceed.)

- [ ] **Step 5: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 6: Render gate (manual).** Serve, open the page. The KO/EN toggle shows in the header; KO active by default; the page is unchanged in KO. (Clicking EN won't fully work until later tasks re-render panels — that's expected now. Static chrome SHOULD switch to English on click, since applyStaticStrings is wired.)
```bash
cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8020 >/dev/null 2>&1 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" "localhost:8020/korean-mbti/"; kill %1 2>/dev/null
```
Expected: `200`. Manual: toggle present, clicking EN switches header/tabs/footer/intro to English.

- [ ] **Step 7: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: header KO/EN toggle + setLang + load-time apply"
```

---

## Task 5: Route render functions through `t()`/`L()` + add `rerenderActivePanel()`

**Files:** Modify `korean-mbti/index.html` — `renderQuestion` (2448), `renderResultHTML` (2667), `renderFnStack` (2746), `renderGallery` (2804), `renderGalleryDetail` (2841), `AXIS_LABELS`/`FN_RANK_LABEL`/`DIAL_BUCKETS`/`TEMPERAMENT_GROUPS` reads, and add `rerenderActivePanel`.

**Context:** Replace embedded Korean literals in these render functions with `t(...)`, and per-data reads with `L(...)`. The DATA objects' `_en` fields are added in Tasks 7–9; until then `L()` falls back to KO, so KO mode is unaffected and EN mode shows KO for not-yet-translated data (safe, visible progress). This task wires the RENDERERS; later tasks fill DATA.

- [ ] **Step 1: `renderQuestion` (line ~2448)** — replace literals:
  - `← 이전` → `${t("navBack")}`, `다음 →` → `${t("navNext")}`, `결과 보기 →` → `${t("navSeeResult")}`.
  - `q.prompt` → `${L(q, "prompt")}`, `q.a.text` → `${L(q.a, "text")}`, `q.b.text` → `${L(q.b, "text")}`.
  - The `$("#q-axis")` line uses `AXIS_LABELS[q.axis].left/right`. Change `AXIS_LABELS` to a lang-aware read (see Step 5).

- [ ] **Step 2: `renderResultHTML` (line ~2667)** — replace:
  - `4 축 분석` → `${t("axesHeading")}`, the axes-sub div inner → `${t("axesSubHTML")}` (set via the same template; it contains `<em>` so it's fine inside innerHTML of the result container).
  - `읽어드린 결` → `${t("readingHeading")}`.
  - `결과 카드 저장` → `${t("saveCardBtn")}`.
  - secondary `2순위` → `${t("secondaryLabel")}`.
  - pills `93-Q FORM-M LENGTH`/`28-Q QUICK`/`DEMO` → `t("pillFull")`/`t("pillQuick")`/`t("pillDemo")`.
  - nickname/one-liner/vibes/evidence/reading reads: route through `L(...)` against the result object `r` (its fields are `nickname_ko`, `one_liner_ko`, `reading_ko`, `evidence_ko`, `vibes_ko`, `reasoning_ko`) → use `L(r,"nickname")`, `L(r,"one_liner")`, `L(r,"reading")`, `L(a,"evidence")`, `L(r,"vibes")` etc. NOTE: `vibes_ko` is an array — `L` returns the array; map over it unchanged.
  - facet pole names (`a.facets[].left/right` or via FACETS): route through `L(facet,"left")`/`L(facet,"right")`.

- [ ] **Step 3: `renderFnStack` (line ~2746)** — replace:
  - heading `인지 기능 스택 — Function Stack` → `${t("fnStackHeading")}`.
  - subtitle → `${t("fnStackSubHTML")}` (keep appending `${escapeHTML(stackStr)}` after it as today).
  - bucket label `b.ko` → `${L(b, "label")}` (DIAL_BUCKETS gains `label_ko`/`label_en` in Task 8; until then add a temporary alias: in this step, read `L(b,"label") || b.ko`). To avoid churn, in Task 8 we rename `ko`→`label_ko` and add `label_en`; here use `L(b,"label")` and ALSO add `b.ko` fallback inline: `${L(b,"label") || b.ko}`.
  - `b.desc` → `${L(b,"desc")}` with `|| b.desc` fallback: `${L(b,"desc") || b.desc}`.
  - rank label: `FN_RANK_LABEL[ord]` → a lang-aware read (Step 5).
  - off-stack tip Korean `이 유형의 기본 스택에는 없는 결.` → `${t("fnOffStackTip")}`.

- [ ] **Step 4: `renderGallery` (2804) + `renderGalleryDetail` (2841)** — replace:
  - gallery intro literal → `${t("galleryIntro")}` (if it's static markup it's already tagged in Task 3; if it's generated here, use `t`).
  - temperament `group.label` → `${L(group, "label")}` (TEMPERAMENT_GROUPS gains `label_en` in Task 8; inline fallback `|| group.label`).
  - card short nickname: `(meta.nickname||"").split(" · ")[0]` → `(L(meta,"nickname")||"").split(" · ")[0]`.
  - detail: `← 도감` → `${t("galleryBack")}`; nickname → `L(meta,"nickname")`; one_liner → `L(meta,"one_liner")`; vibes → `L(meta,"vibes")`; the note paragraph → `${t("galleryNoteHTML")}<a href="#" data-action="goto-test">${t("galleryNoteLink")}</a>`.

- [ ] **Step 5: Lang-aware AXIS_LABELS + FN_RANK_LABEL.** These are flat objects, not `_ko/_en` data. Convert to `STR`-style. Simplest: add helper readers near AXIS_LABELS:
```javascript
function axisLabel(axisKey, side) { // side: "left" | "right"
  const en = { EI:{left:"E · Extraversion",right:"I · Introversion"}, SN:{left:"S · Sensing",right:"N · Intuition"}, TF:{left:"T · Thinking",right:"F · Feeling"}, JP:{left:"J · Judging",right:"P · Perceiving"} };
  return (LANG === "en" ? en : AXIS_LABELS)[axisKey][side];
}
function rankLabel(ord) {
  const en = {1:"Dominant",2:"Auxiliary",3:"Tertiary",4:"Inferior",5:"Off-stack"};
  return (LANG === "en") ? en[ord] : FN_RANK_LABEL[ord];
}
```
Replace `AXIS_LABELS[q.axis].left`/`.right` reads in `renderQuestion` and `renderResultHTML` with `axisLabel(q.axis,"left")`/`("right")` (preserving the existing `.split(" · ")[0]` logic — note EN labels also contain ` · `, so the split still yields the letter). Replace `FN_RANK_LABEL[ord]` usage in `renderFnStack` with `rankLabel(ord)` (and update any `.split(" · ")` accordingly — EN rank labels have NO ` · `, so where the code does `rankLabel.split(" · ")[1] || rankLabel`, that yields the whole EN label, correct).

- [ ] **Step 6: Add `rerenderActivePanel()`** near `setLang`:
```javascript
function rerenderActivePanel() {
  const active = document.querySelector(".panel.active")?.id;
  if (active === "panel-test") {
    if ($("#test-result") && $("#test-result").innerHTML.trim() && $("#test-result").style.display !== "none") {
      if (typeof state !== "undefined" && state.lastResult) {
        $("#test-result").innerHTML = renderResultHTML(state.lastResult);
        wireGenderToggle($("#test-result"));
      }
    } else if (typeof state !== "undefined" && state.qIndex != null && QUESTIONS && QUESTIONS[state.qIndex]) {
      renderQuestion();
    }
  } else if (active === "panel-gallery") {
    if ($("#gallery-grid")?.style.display !== "none") showGalleryGrid();
    else { const ty = $("#gallery-detail")?.querySelector(".type-portrait")?.dataset.type; if (ty) showGalleryDetail(ty); }
  } else if (active === "panel-ai") {
    if ($("#ai-result") && $("#ai-result").innerHTML.trim() && window.__lastAIResult) {
      $("#ai-result").innerHTML = renderResultHTML(window.__lastAIResult);
      wireGenderToggle($("#ai-result"));
    }
  }
}
```
**Discovery sub-step:** before writing this, `grep -n "state.lastResult\|lastResult\|__lastAIResult\|state = {\|let state\|const state\|state.qIndex\|renderResultHTML(" korean-mbti/index.html` to find how the test result object and AI result object are stored. If the test result isn't already cached on `state`, add `state.lastResult = <resultObj>;` at the point `showResult()` builds it, and cache the AI result to `window.__lastAIResult` where the AI render happens. Adjust the names above to match what exists. Report findings.

- [ ] **Step 7: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 8: Render gate (manual).** KO mode unchanged. Switch to EN: UI chrome + headings + nav + axis/rank labels render English; per-type DATA (questions, nicknames…) still show Korean (fallback) until Tasks 7–9. Confirm no blanks, no console errors, state preserved across toggle (start a quiz, answer 2, toggle EN → still on Q3 with answers intact).

- [ ] **Step 9: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: route renderers through t()/L() + rerenderActivePanel + lang-aware axis/rank labels"
```

---

## Task 6: Translate `TYPES`, `FACETS`, `DIAL_BUCKETS`, `TEMPERAMENT_GROUPS`

**Files:** Modify `korean-mbti/index.html` — `FACETS` (1626), `TYPES` (1980), `DIAL_BUCKETS` (2058), `TEMPERAMENT_GROUPS` (2068).

**Context:** Add `_en` siblings. EN nicknames = the canonical archetype titles listed at top of plan. EN one-liners + vibes = natural English capturing the same meaning/voice (concise, lowercase-casual where the Korean is casual). Facet/bucket/group labels = the canonical EN lists at top of plan.

- [ ] **Step 1: `FACETS` — add `left_en`/`right_en` to all entries.** Rename is not needed; ADD fields. For each entry add the canonical EN poles, e.g.:
```javascript
  ER: { axis: "EI", left: "주도", right: "수용", left_en: "Initiating", right_en: "Receiving", leftLetter: "E", rightLetter: "I" },
```
Apply EN poles from the plan's facet list to every FACETS entry. Then update `renderResultHTML`/facet rendering to read `L(facet,"left")`/`L(facet,"right")` (done in Task 5 Step 2 — confirm). Keep existing `left`/`right` as the KO source (so `L` returns them when `_ko` absent — but to be consistent, ALSO copy `left`→`left_ko`? NO: `L(obj,"left")` checks `left_en` → `left_ko` → `left`; since there's no `left_ko`, it falls to bare `left` (Korean). That works. Leave `left`/`right` as the KO values.)

- [ ] **Step 2: `TYPES` — add `nickname_en`, `one_liner_en`, `vibes_en` to all 16.** Keep existing `nickname`/`one_liner`/`vibes` as KO (L falls back to them). Example:
```javascript
  INTJ: { nickname: "전략가 · 마스터플랜의 사람",
          one_liner: "머릿속에 5년 뒤까지 그려놓고 살아간다. 침착·치밀·독립적.",
          vibes: ["계획충", "혼자가 편한", "장기 사고"],
          nickname_en: "INTJ · The Architect",
          one_liner_en: "Already mapping five years ahead. Calm, meticulous, independent.",
          vibes_en: ["master planner", "happy solo", "long-game thinker"] },
```
Author all 16 with the canonical archetype title in `nickname_en` (format: `"<CODE> · The <Title>"`), a faithful one-liner, and 3 short vibe phrases. **Voice:** match the Korean's casual register; keep vibes short (1–3 words).

- [ ] **Step 3: `DIAL_BUCKETS` — add `label_ko`/`label_en` + `desc_en`.** Convert:
```javascript
  { key: "T", han: "思", ko: "사고", label_ko: "사고", label_en: "Thinking", desc: "논리·기준·체계로 판단하는 결", desc_en: "judging by logic, standards, and systems" },
```
(Keep `ko` and `desc` for safety; add the new fields. `renderFnStack` from Task 5 reads `L(b,"label")||b.ko` and `L(b,"desc")||b.desc`.) Apply to all 4 buckets with the canonical EN bucket names + English descs.

- [ ] **Step 4: `TEMPERAMENT_GROUPS` — add `label_en`.**
```javascript
  { key: "NT", label: "NT · 분석가", label_en: "NT · Analysts", anchor: "#ADA7FF", types: [...] },
```
Apply NT Analysts / NF Diplomats / SJ Sentinels / SP Explorers.

- [ ] **Step 5: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 6: No-Korean-in-EN gate**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const h=require("fs").readFileSync("korean-mbti/index.html","utf8");
const hang=/[가-힣]/;
const en=[...h.matchAll(/(nickname_en|one_liner_en|label_en|desc_en|left_en|right_en):\s*"([^"]*)"/g)];
const bad=en.filter(m=>hang.test(m[2]));
const vibesEn=[...h.matchAll(/vibes_en:\s*\[([^\]]*)\]/g)].filter(m=>hang.test(m[1]));
console.log("en scalar fields="+en.length, "with hangul="+bad.length, "vibes_en with hangul="+vibesEn.length);
bad.slice(0,5).forEach(m=>console.log("  BAD:",m[1],m[2]));
'
```
Expected: `with hangul=0`, `vibes_en with hangul=0`. Also confirm 16 `nickname_en` present:
```bash
grep -c "nickname_en:" korean-mbti/index.html   # expect 16
```

- [ ] **Step 7: Render gate (manual).** EN mode: gallery cards + detail + result show English nicknames/one-liners/vibes; function stack buckets English; temperament sections "NT · Analysts" etc.; facet rows English poles.

- [ ] **Step 8: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: translate TYPES/FACETS/DIAL_BUCKETS/TEMPERAMENT_GROUPS (EN fields)"
```

---

## Task 7: Translate the 93-question bank (`QUESTIONS_FULL`)

**Files:** Modify `korean-mbti/index.html` — `QUESTIONS_FULL` (1658–1965).

**Context:** Each entry gets `prompt_en`, and each choice gets `text_en`. Keep the Korean `prompt`/`text` (L falls back to them). The renderer already reads `L(q,"prompt")`, `L(q.a,"text")`, `L(q.b,"text")` (Task 5).

- [ ] **Step 1: Add `prompt_en` + `a.text_en` + `b.text_en` to every entry.** Example:
```javascript
  { axis: "EI", facet: "ER", prompt: "처음 가본 모임에서 자연스러운 모습", prompt_en: "At a gathering you've come to for the first time, what feels natural", quick: true,
    a: { letter: "E", text: "내가 먼저 옆 사람에게 말을 거는 편이다.", text_en: "I tend to be the one who speaks to the person next to me first." },
    b: { letter: "I", text: "상대가 먼저 말을 걸어오기를 기다리는 편이다.", text_en: "I tend to wait for the other person to speak to me first." } },
```
**Voice rules:** natural conversational English, second-person where the Korean is, keep each choice a single clear sentence, preserve the E/I/S/N/T/F/J/P contrast exactly (don't soften the poles). Translate all 93 entries. This is the bulk content task — author real translations, not stubs.

- [ ] **Step 2: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 3: Coverage + no-Korean gate**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const h=require("fs").readFileSync("korean-mbti/index.html","utf8");
const block=h.match(/const QUESTIONS_FULL = \[[\s\S]*?\n\];/)[0];
const prompts=(block.match(/prompt:/g)||[]).length, promptsEn=(block.match(/prompt_en:/g)||[]).length;
const texts=(block.match(/\btext:/g)||[]).length, textsEn=(block.match(/text_en:/g)||[]).length;
const hang=/[가-힣]/;
const enVals=[...block.matchAll(/(prompt_en|text_en):\s*"([^"]*)"/g)];
const bad=enVals.filter(m=>hang.test(m[2])).length;
console.log("prompt="+prompts, "prompt_en="+promptsEn, "text="+texts, "text_en="+textsEn, "en-with-hangul="+bad);
'
```
Expected: `prompt_en` == `prompt` count, `text_en` == `text` count, `en-with-hangul=0`.

- [ ] **Step 4: Render gate (manual).** EN mode, take the quick test — every question + both choices read in English; KO mode unchanged.

- [ ] **Step 5: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: translate all 93 test questions + choices (EN)"
```

---

## Task 8: Translate `CANNED` outputs + `SAMPLES` + dynamic strings/counter

**Files:** Modify `korean-mbti/index.html` — `CANNED` (2118), `SAMPLES` (3158), and the scattered dynamic strings (counter, errors, mic hints, save-button states, stage label).

- [ ] **Step 1: `CANNED` — add `_en` twins.** For each of the 4 entries' `result`, add `nickname_en`, `one_liner_en`, `reading_en`, `vibes_en`, `secondary_type.reasoning_en`, and per-axis `evidence_en`; per-facet add `left_en`/`right_en` (or rely on FACETS — but CANNED facets are inline objects, so add `_en` poles there). Also extend each entry's `matches` array with English keywords (so canned EN triggers on English samples). The renderer reads these via `L(r,"reading")`, `L(a,"evidence")`, `L(r,"vibes")`, `L(r,"nickname")`, `L(r,"one_liner")`, `L(sec,"reasoning")` (confirm Task 5 routed them). EN narratives must read as authentic English MBTI prose in the same warm voice — not literal.

- [ ] **Step 2: `SAMPLES` — add `diary_en`/`kakao_en`/`reflect_en`.** Authentic English rewrites (diary entry, casual chat, self-reflection) voice-matched, ~200–400 chars each. Update the sample-chip handler to insert `L(SAMPLES_OBJ,...)` — find the handler (`grep -n "SAMPLES" korean-mbti/index.html`) and make it pick `SAMPLES["diary"+...]`? Simpler: store as `SAMPLES = { diary_ko, diary_en, kakao_ko, ... }` and the handler reads `SAMPLES[name + "_" + LANG] ?? SAMPLES[name + "_ko"]`. Adjust handler accordingly (report the exact handler code you change).

- [ ] **Step 3: Dynamic strings.** Replace each scattered Korean literal with `t(...)` using the keys from Task 2:
  - counter: where it sets `textContent = n + "자"` → `n + t("counterSuffix")`.
  - counter hints (5 variants) → `t("hintShort"/"hintMin"/"hintMore"/"hintGood"/"hintLong")`.
  - errors (`showError(...)`) → `t("errClipboard"/"errNoKey"/"errTooShort"/"errKeyRejected"/"errGeneric")`.
  - mic hints/labels → `t("micUnsupportedTitle"/...)`.
  - stage label `분석 중…` → `t("stageReading")` (also tagged static; if set via JS, use t()).
  - save-card button states → `t("cardSaving"/"cardSaved"/"cardFailed")`; the button label → `t("saveCardBtn")`.
  - mode pill `데모 모드`/`실시간 모드` → `t("modeDemoPill")/t("modeLivePill")`.
  Find each via grep (the spec inventory §8 lists line numbers as a guide; re-grep for current lines).

- [ ] **Step 4: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 5: No-Korean-in-EN gate for CANNED/SAMPLES**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const h=require("fs").readFileSync("korean-mbti/index.html","utf8");
const hang=/[가-힣]/;
const en=[...h.matchAll(/(reading_en|evidence_en|reasoning_en|nickname_en|one_liner_en|diary_en|kakao_en|reflect_en):\s*[`"]([^`"]*)[`"]/g)];
const bad=en.filter(m=>hang.test(m[2]));
console.log("canned/sample en fields="+en.length, "with hangul="+bad.length);
bad.slice(0,5).forEach(m=>console.log("  BAD:",m[1]));
'
```
Expected: `with hangul=0` and a nonzero field count.

- [ ] **Step 6: Render gate (manual).** EN mode, AI tab: tap a sample chip → English passage loads; "Read me →" in canned/demo mode → English reading/evidence/vibes render; counter shows "N chars"; trigger an error (empty key in live mode) → English error.

- [ ] **Step 7: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: translate CANNED outputs, SAMPLES, and dynamic UI strings (EN)"
```

---

## Task 9: English AI system prompt (`SYS_EN`) + language-select at call site

**Files:** Modify `korean-mbti/index.html` — the AI call (`const sys = ` at ~3402).

**Context:** Produce an English counterpart of the existing Korean `<role>…</role>` prompt with IDENTICAL XML tag structure and IDENTICAL `<output_schema>` field NAMES, so the renderer consumes either language unchanged. This is a re-rendering of embedded domain knowledge, not new research.

- [ ] **Step 1: Capture the current prompt as `SYS_KO`.** Rename the existing `const sys = \`<role>…\`;` to `const SYS_KO = \`<role>…\`;` (same content).

- [ ] **Step 2: Author `SYS_EN`.** Add `const SYS_EN = \`<role>…\`;` with the SAME tag spine. Adaptations:
  - `<role>`: a working analyst reading English self-writing; English MBTI vocabulary; explicitly NOT a clinical diagnosis.
  - `<voice>`: **respond in English**; warm, concise, second person.
  - `<canonical_types>`: 16 codes + the archetype titles (from plan top).
  - `<canonical_facets>`: same 20 facets, English poles (from plan top).
  - `<errors_to_avoid>`: same intent as KO list, in English (do not output Korean; don't hedge into "consult a professional"; keep to the 4 axes + facets; etc.).
  - `<output_constraints>` + `<output_schema>`: **field names byte-identical to SYS_KO's schema** (`type`, `nickname`/`nickname_ko`?, `axes[].confidence`, `evidence`/`evidence_ko`?, `reading`/`reading_ko`?, `vibes`…). DISCOVERY REQUIRED: read SYS_KO's `<output_schema>` and the response-parsing code to learn the EXACT field names the parser expects. If the parser reads `reading_ko`, then SYS_EN must ALSO emit `reading_ko` (the field name is a contract, even if the value is English) OR the parser must be made lang-agnostic. Pick the lower-risk option: keep the SAME field names SYS_KO uses, so the parser is untouched. Report the exact schema field names found.
  - `<exemplar>`: one English worked example.

- [ ] **Step 3: Select prompt by language at the call site.** Where the API body is built, set `const sys = (LANG === "en") ? SYS_EN : SYS_KO;`. Confirm the rest of the request (model, max_tokens, messages) is unchanged.

- [ ] **Step 4: Syntax gate** → `OK 2 blocks`.

- [ ] **Step 5: Schema-parity gate.** Verify SYS_EN and SYS_KO declare the same schema field names:
```bash
cd /home/ubuntu/projects/vibe-demos
node -e '
const h=require("fs").readFileSync("korean-mbti/index.html","utf8");
function fields(name){const m=h.match(new RegExp("const "+name+" = `[\\s\\S]*?`;"));if(!m)return null;const f=[...m[0].matchAll(/"([a-z_]+)"\s*:/g)].map(x=>x[1]);return [...new Set(f)].sort();}
const ko=fields("SYS_KO"), en=fields("SYS_EN");
console.log("SYS_KO fields:",JSON.stringify(ko));
console.log("SYS_EN fields:",JSON.stringify(en));
console.log("identical sets:", JSON.stringify(ko)===JSON.stringify(en));
'
```
Expected: both non-null and `identical sets: true` (or a clearly-explained superset if the schema legitimately differs; the goal is the parser reads the same names).

- [ ] **Step 6: Render/verify gate.** Canned EN mode is fully verifiable (no key) — already covered Task 8. For LIVE EN: cannot self-verify without a key. Confirm structurally that `sys` switches on LANG and the parser is untouched. FLAG for user verification with a real key.

- [ ] **Step 7: Commit**
```bash
git add korean-mbti/index.html
git commit -m "korean-mbti: English AI system prompt (SYS_EN) + lang-select at call site"
```

---

## Task 10: SW bump, meta lang, final verification

**Files:** Modify `korean-mbti/sw.js:1`; optionally `korean-mbti/index.html` meta.

- [ ] **Step 1: Bump cache.** `korean-mbti/sw.js` line 1: `const CACHE = "vibe-korean-mbti-v12";` → `"vibe-korean-mbti-v13";`.

- [ ] **Step 2: Final syntax + serve gate.**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e 'const fs=require("fs");const h=fs.readFileSync("korean-mbti/index.html","utf8");const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];let ok=true;m.forEach((s,i)=>{try{new Function(s[1])}catch(e){ok=false;console.log("Block "+i+" ERROR:",e.message)}});console.log(ok?"OK "+m.length+" blocks":"FAILED")'
python3 -m http.server 8020 >/dev/null 2>&1 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" "localhost:8020/korean-mbti/"; kill %1 2>/dev/null
```
Expected: `OK 2 blocks`, `200`.

- [ ] **Step 3: Whole-page no-blank gate (manual, both languages).** Toggle EN, walk every surface: header/tabs/intro, full + quick test (a few Qs), result screen (axes, facets, fn-stack, vibes, save button), gallery (grid, all 4 group labels, a detail + note), AI tab (chrome, sample chips, canned read). Then toggle back to KO and confirm identical-to-before behavior. No Korean leaking in EN data fields; no English leaking into KO; no blanks; state preserved across toggles.

- [ ] **Step 4: Commit.**
```bash
git add korean-mbti/sw.js
git commit -m "korean-mbti: bump SW cache v12 → v13 for language toggle"
```

---

## Task 11: Deploy decision (STOP — ask user)

- [ ] **Step 1:** Show `git log --oneline main..HEAD` and `git branch --show-current`.
- [ ] **Step 2:** Ask the user: merge to `main` + push (deploys), open a PR, or leave on branch. If merging, mirror the safe approach (fetch latest, rebuild on `origin/main`, no force-push). FLAG that the live EN AI path is unverified without their key, and offer to verify if they paste one or test it themselves post-deploy.

---

## Self-review

**Spec coverage:**
- Core mechanism (`STR`/`t`/`L`/`LANG`, KO fallback) → Task 1. ✓
- All fixed UI strings KO+EN → Task 2 (+ parity gate). ✓
- Static chrome swap (`data-i18n`, `applyStaticStrings`) → Task 3. ✓
- Toggle UI, `setLang`, `<html lang>`, load-time apply, persistence → Task 4. ✓
- Renderers via `t()/L()`, `rerenderActivePanel`, state preservation, lang-aware axis/rank → Task 5. ✓
- TYPES/FACETS/DIAL_BUCKETS/TEMPERAMENT_GROUPS EN (archetype titles) → Task 6. ✓
- 93 questions EN → Task 7. ✓
- CANNED + SAMPLES + dynamic strings EN → Task 8. ✓
- SYS_EN + call-site select + schema-name parity → Task 9. ✓
- SW bump + final verification + KO-regression check → Task 10. ✓
- Branch-first; deploy gate → Task 0; Task 11. ✓
- Partial-translation safety (KO fallback) → built into `L`/`t`, exercised by every "render gate" before its data task lands. ✓

**Placeholder scan:** The bulk-content tasks (7, 8, 9) intentionally specify "author real translations following these rules + exemplars + no-Korean gate" rather than pre-pasting all 93 questions / the 600-line prompt verbatim — translation is judgment work and pre-authoring every string would make the plan unmaintainable. Each such task pins: exact mechanics (complete), a worked exemplar (complete), canonical fixed values (complete), voice rules, and a deterministic no-Korean/coverage verification gate. The discovery sub-steps in Tasks 5/8/9 (find exact state/handler/schema names) are explicit "read then match" instructions, not vague placeholders.

**Type/name consistency:** `LANG`, `setLangValue`/`setLang`, `t`, `L`, `STR`, `applyStaticStrings`, `syncLangToggle`, `rerenderActivePanel`, `axisLabel`, `rankLabel`, `SYS_KO`/`SYS_EN`, field suffixes `_ko`/`_en` — used consistently across tasks. `L(r,"vibes")` returns an array (noted in Task 5). Inline fallbacks (`L(b,"label")||b.ko`) used in Task 5 are reconciled when Task 6 adds the real `_en`/`_ko` fields.

**Scope:** One feature (a language toggle), one file (+SW). Large but cohesive; sequenced mechanism→data→AI so each task leaves the page working (KO always intact, EN progressively filled with safe fallback).
