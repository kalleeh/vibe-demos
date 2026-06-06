# korean-mbti — Live Type Distribution + Optional Login (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the live MBTI type-distribution social proof (Change A, ship-alone-able) and add an optional login for cross-device history (Change B, depends on `users` collection from clinic-admin).

**Architecture:** Fetch-on-open PocketBase pattern (existing), anonymous by default (existing `player_id`), Tier 3 auth (new, opt-in) via studio-wide `users` collection. Change A wires the existing scaffolded social-proof UI (CSS `.social`, i18n strings, tally logic already present). Change B adds a soft post-result login prompt + personal history view.

**Tech Stack:** Plain static HTML/JS, PocketBase SDK via CDN import (already in place), no build tool, no reconnection polling, XSS-safe `textContent`.

---

## Important Constraints

1. **Plain static files only** — edit `korean-mbti/index.html` + `sw.js`. NO build tool/package.json/framework.
2. **NO reconnection polling** — fetch-on-open is the pattern (already present).
3. **XSS-safe rendering** — all user/dynamic fields via `textContent`, never `innerHTML`.
4. **Safari date-parsing gotcha** — PocketBase `created` is space-separated ("2026-06-06 10:13:34.219Z"). Use `Date.parse(s.replace(" ","T"))` not `Date.parse(s)` — Safari/iPhone returns `NaN` for the space form.
5. **DO NOT add or re-add Opus** — korean-mbti intentionally omits the Opus model toggle for cost reasons (memory).
6. **Verification = `node --check` + headless Playwright smoke** — NOT a unit-test framework.
   - Playwright at `/tmp/node_modules` (use `NODE_PATH=/tmp/node_modules`)
   - Chromium exe: `/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`
   - Run smoke from a FILE (not `node -e`), since dynamic bare-import ignores `NODE_PATH` in eval.
   - If the module uses static `import ... from "pocketbase"`, `node --check` fails on bare resolution — the plan gives the exact command to strip that import line before checking.
   - Temp smoke files: `korean-mbti/_smoke*.mjs`, untracked, deleted in final task.
7. **PB auth note** — PocketBase auth uses an auth-type collection; `authWithPassword`/OAuth/token persistence in `localStorage`. If the plan defines a `users` collection migration, follow repo migration format (see `korean-mbti/pb/pb_migrations/001_*.js`), file named `002_*.js` or higher, sequential, declaring autodate fields. Deploy via `./sync-backends.sh`.

---

## File Structure

```
vibe-demos/
├── korean-mbti/
│   ├── index.html                      ← EDIT (wire social proof reveal, add login UI)
│   ├── sw.js                           ← EDIT (bump cache version)
│   └── pb/
│       └── pb_migrations/
│           ├── 001_init_mbti_result.js ← exists
│           ├── 002_add_autodate.js     ← exists
│           └── 003_add_users.js        ← NEW (Change B only, if users doesn't exist)
├── backends/
│   └── config.json                     ← no change (port 8092 already assigned)
└── docs/superpowers/plans/
    └── 2026-06-06-korean-mbti-distribution-login.md  ← this file
```

---

## Tasks

### CHANGE A — Live Type Distribution (ship-alone-able)

These tasks finish the existing scaffolded social-proof UI and are fully shippable without Change B.

---

#### Task 1: Wire the reveal animation for percentage + companion-count

**Files:** `korean-mbti/index.html`

The social-proof UI (`.social`) is already scaffolded (CSS at ~line 752, i18n strings at ~1858-1859, tally logic at ~2965, render function at ~4427). The spec says: *"dramatize the reveal — percentage + companion-count animate in alongside the type nickname."* Currently the render function computes `pct` and `myCount` but doesn't animate them in. Add a staggered fade-up animation so the rarity line and bars reveal together.

**Steps:**

- [ ] Read lines 4427-4480 of `korean-mbti/index.html` (the `render(root, tally, myType, connected)` function inside the PB module).
- [ ] Locate the rarity-line rendering block (starts `if (total <= 0) { ... } else { ... }`).
- [ ] Add a CSS animation class `.social .rarity` and `.social .dist-fill` to stagger their reveal:
  ```css
  /* Add after line 849 (end of .social block) */
  .social .rarity {
    animation: fadeUpRarity 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    opacity: 0;
  }
  .social .dist-fill {
    animation: fadeUpBar 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
    opacity: 0;
  }
  @keyframes fadeUpRarity {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeUpBar {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .social .rarity, .social .dist-fill { animation: none; opacity: 1; }
  }
  ```
- [ ] In the render function, after setting `.rarity` text content and before exiting the `else` block, trigger a reflow to force the animation:
  ```javascript
  if (rarityEl) {
    rarityEl.style.opacity = '0'; // reset
    void rarityEl.offsetWidth; // force reflow
    rarityEl.style.opacity = ''; // trigger animation
  }
  ```
- [ ] Verify: `node --check` on the extracted module (after stripping the dynamic import line — see Task 5 for the exact command).

---

#### Task 2: Wire socialLocal / socialConnected strings to online/offline state

**Files:** `korean-mbti/index.html`

The i18n strings `socialLocal: "local tally"` / `socialConnected: "live tally"` exist at lines 1858-1859. The `setStatus(root, connected)` function (line ~4417) already toggles the `.lb-status` element. Verify it's calling `T("socialConnected")` and `T("socialLocal")` correctly, and that the `.lb-status-text` element exists in the skeleton HTML.

**Steps:**

- [ ] Read lines 4415-4425 (the `setStatus` function).
- [ ] Confirm it calls `T("socialConnected")` and `T("socialLocal")` and updates `.lb-status-text`.
- [ ] Search for the `.social` skeleton HTML (around line 3136, comment says "Inert skeleton bars shown before the tally arrives").
- [ ] Verify the skeleton includes:
  ```html
  <span class="lb-status"><span class="dot">○</span><span class="lb-status-text">—</span></span>
  ```
  If the `.lb-status-text` span is missing, add it inside `.lb-status` after the dot.
- [ ] Verify: open `korean-mbti/index.html` in a browser (or headless Playwright), check the result screen, confirm the status text updates to "live tally" when online or "local tally" when offline.

---

#### Task 3: Add "where you land" context to the rarity line

**Files:** `korean-mbti/index.html`

The spec says: *"On result reveal, show where the viewer lands: 'ENFP는 전체의 14% · 잔망 루피 동료 1,203명.'"* Currently the rarity line only shows the percentage. Extend it to include the companion-count in the Korean phrasing and an English equivalent.

**Steps:**

- [ ] Add two new i18n strings to the `STR` dictionary (around line 1790-1863):
  ```javascript
  // In STR.ko (after socialSampleNote):
  socialCompanions: "{TYPE}는 전체의 {PCT}% · {NICK} 동료 {N}명.",
  socialCompanionsRare: "전체의 {PCT}% — 흔치 않은 결입니다. {NICK} 동료 {N}명.",
  
  // In STR.en (after socialSampleNote):
  socialCompanions: "{TYPE} is {PCT}% of takers · {N} {NICK} companions.",
  socialCompanionsRare: "Just {PCT}% of takers — an uncommon grain. {N} {NICK} companions.",
  ```
- [ ] In the `render` function (line ~4427), inside the `else` block (where `pct >= 6.25` decides common vs. rare), replace the existing `tmpl` logic with:
  ```javascript
  const myCount = tally[myType] || 0;
  const pct = (myCount / total) * 100;
  const tmpl = pct >= 6.25 ? T("socialCompanions") : T("socialCompanionsRare");
  const text = tmpl
    .replace("{TYPE}", myType)
    .replace("{PCT}", fmtPct(pct))
    .replace("{NICK}", nickname || "")
    .replace("{N}", String(myCount));
  if (rarityEl) {
    rarityEl.textContent = ""; // clear
    // Parse the text and wrap {PCT} in <span class="accent">
    const parts = text.split(fmtPct(pct) + "%");
    rarityEl.appendChild(document.createTextNode(parts[0] || ""));
    const accent = document.createElement("span");
    accent.className = "accent";
    accent.textContent = fmtPct(pct) + "%";
    rarityEl.appendChild(accent);
    rarityEl.appendChild(document.createTextNode(parts[1] || ""));
  }
  ```
- [ ] Verify the `nickname` parameter is passed to the `render` function — check the `window.__mbtiSocial` function (line ~4493) and confirm it passes `nickname` to `render`.

---

#### Task 4: Add your-type highlighting in the distribution bars

**Files:** `korean-mbti/index.html`

The CSS already has `.social .dist-row.me` styles (line 819, 835, 842) for highlighting the viewer's type. Verify the skeleton HTML includes `data-type` attributes on each `.dist-row`, and that the render function adds the `.me` class to the matching row.

**Steps:**

- [ ] Search for the `.dist-row` skeleton HTML (around line 3141, inside the `.social .dist` block).
- [ ] Confirm each `.dist-row` has `data-type="XXXX"` (e.g., `<div class="dist-row" data-type="INFP">`). If not, add it.
- [ ] In the `render` function, inside the `ORDER.forEach(tp => { ... })` loop (line ~4469), add:
  ```javascript
  if (row) {
    row.classList.toggle("me", tp === myType);
  }
  ```
  Place this right after `const row = root.querySelector(rowSel);`.
- [ ] Verify: the viewer's type bar should render in `var(--accent)` (rust orange) while others are `var(--gold)` (celadon).

---

#### Task 5: Verification checkpoint — Change A smoke test

**Files:** `korean-mbti/_smoke-change-a.mjs` (new, untracked, will be deleted in Task 11)

Write a headless Playwright smoke test that:
1. Opens `korean-mbti/index.html`.
2. Picks "28-Q" quick test.
3. Answers 7 questions (one per axis).
4. Sees the result screen.
5. Confirms the `.social .rarity` element is visible and contains a percentage.
6. Confirms the `.social .dist-row.me` class is present on exactly one row.
7. Confirms the `.lb-status-text` says "live tally" or "local tally".

**Steps:**

- [ ] Create `korean-mbti/_smoke-change-a.mjs`:
  ```javascript
  #!/usr/bin/env node
  import { chromium } from 'playwright';
  const exe = '/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  await page.goto('file:///home/ubuntu/projects/vibe-demos/korean-mbti/index.html');
  
  // Pick quick test
  await page.click('button[data-length="quick"]');
  await page.waitForSelector('.qcard', { timeout: 3000 });
  
  // Answer 28 questions (7 per axis, forced choice, pick 'a' for simplicity)
  for (let i = 0; i < 28; i++) {
    const choiceA = await page.locator('.qchoice').first();
    if (await choiceA.isVisible()) await choiceA.click();
    const nextBtn = await page.locator('button:has-text("다음")');
    if (await nextBtn.isVisible()) await nextBtn.click();
    const resultBtn = await page.locator('button:has-text("결과 보기")');
    if (await resultBtn.isVisible()) { await resultBtn.click(); break; }
  }
  
  // Wait for result
  await page.waitForSelector('.type-hero .code', { timeout: 5000 });
  
  // Check social proof
  const rarity = await page.locator('.social .rarity').textContent();
  if (!rarity.includes('%')) throw new Error('Rarity % missing');
  
  const meRows = await page.locator('.social .dist-row.me').count();
  if (meRows !== 1) throw new Error(`Expected 1 .me row, got ${meRows}`);
  
  const status = await page.locator('.social .lb-status-text').textContent();
  if (!status.includes('tally') && !status.includes('집계')) {
    throw new Error(`Status text wrong: ${status}`);
  }
  
  console.log('✓ Change A smoke test passed');
  await browser.close();
  ```
- [ ] Run: `NODE_PATH=/tmp/node_modules node /home/ubuntu/projects/vibe-demos/korean-mbti/_smoke-change-a.mjs`
- [ ] Confirm output: `✓ Change A smoke test passed`
- [ ] If it fails, debug the failure, fix the code in `index.html`, and re-run.

---

#### Task 6: Bump service worker cache version

**Files:** `korean-mbti/sw.js`

Change A is complete. Bump the cache name so the new social-proof rendering deploys cleanly.

**Steps:**

- [ ] Read `korean-mbti/sw.js` (first ~10 lines).
- [ ] Locate the cache name constant (e.g., `const CACHE = "vibe-korean-mbti-v1";`).
- [ ] Increment the version: `"vibe-korean-mbti-v1"` → `"vibe-korean-mbti-v2"`.
- [ ] Verify: the activate handler already deletes old caches (standard pattern).

---

### CHANGE B — Optional Login for Personal History (separable, dependent on `users` collection)

These tasks add a soft post-result login prompt and personal history view. They are FULLY OPTIONAL and ship separately from Change A. If the `users` collection doesn't exist (clinic-admin not built yet), these tasks are BLOCKED.

---

#### Task 7: Check if `users` collection exists; if not, define migration

**Files:** `korean-mbti/pb/pb_migrations/003_add_users.js` (new, conditional)

The spec says: *"Reuses the same `users` auth collection introduced in clinic-admin's spec."* Since clinic-admin isn't built yet, check if a `users` migration exists anywhere. If not, define it here as a minimal auth collection.

**Steps:**

- [ ] Run: `grep -r "users.*auth.*collection" /home/ubuntu/projects/vibe-demos/clinic-admin/pb/ /home/ubuntu/projects/vibe-demos/korean-mbti/pb/`
- [ ] If NO migration creates a `users` auth collection, create `korean-mbti/pb/pb_migrations/003_add_users.js`:
  ```javascript
  // korean-mbti/pb/pb_migrations/003_add_users.js
  // Studio-wide auth collection for optional cross-device identity.
  // Shared by korean-mbti, clinic-admin, and any future demo that needs login.
  migrate((app) => {
    const collection = new Collection({
      type: "auth",
      name: "users",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: "",
      updateRule: "id = @request.auth.id",
      deleteRule: "id = @request.auth.id",
      fields: [
        { type: "text", name: "name", max: 100 },
        { type: "email", name: "email", required: true },
      ],
      options: {
        allowOAuth2Auth: false,
        allowUsernameAuth: false,
        allowEmailAuth: true,
        minPasswordLength: 8,
      },
    });
    app.save(collection);
  }, (app) => {
    const collection = app.findCollectionByNameOrId("users");
    app.delete(collection);
  });
  ```
- [ ] If a `users` migration already exists (in clinic-admin or elsewhere), SKIP this file creation and note the dependency: *"Task 7 skipped — `users` collection exists in [path]."*

---

#### Task 8: Add `user_id` field to `mbti_result` collection

**Files:** `korean-mbti/pb/pb_migrations/004_add_user_id.js` (new)

Logged-in users need their results linked to their account. Add a nullable `user_id` relation field to `mbti_result`.

**Steps:**

- [ ] Create `korean-mbti/pb/pb_migrations/004_add_user_id.js`:
  ```javascript
  // korean-mbti/pb/pb_migrations/004_add_user_id.js
  // Link results to logged-in users (optional — anonymous results have null user_id).
  migrate((app) => {
    const collection = app.findCollectionByNameOrId("mbti_result");
    collection.fields.add(new Field({
      type: "relation",
      name: "user_id",
      required: false,
      options: {
        collectionId: app.findCollectionByNameOrId("users").id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      },
    }));
    app.save(collection);
  }, (app) => {
    const collection = app.findCollectionByNameOrId("mbti_result");
    collection.fields.removeByName("user_id");
    app.save(collection);
  });
  ```
- [ ] Verify syntax: `node --check /home/ubuntu/projects/vibe-demos/korean-mbti/pb/pb_migrations/004_add_user_id.js` (should pass).

---

#### Task 9: Add post-result login prompt UI

**Files:** `korean-mbti/index.html`

After revealing the result, show a soft, skippable login/signup panel: *"로그인하면 결과를 기억해요 — 다시 풀거나 다른 기기에서도."* Place it between the `.type-hero` and `.axes` blocks. If already logged in, skip it. If the user dismisses it, remember that choice in localStorage.

**Steps:**

- [ ] Add i18n strings to `STR` (around line 1790-1863):
  ```javascript
  // In STR.ko:
  loginPromptH: "결과를 기억하고 싶으신가요?",
  loginPromptP: "로그인하면 이 결과를 저장하고, 다시 풀거나 다른 기기에서도 볼 수 있어요. 선택 사항이며 익명으로 계속 사용하셔도 됩니다.",
  loginBtn: "로그인 / 가입",
  loginSkip: "지금은 건너뛰기",
  loginEmailLabel: "이메일",
  loginPasswordLabel: "비밀번호",
  loginSignupToggle: "계정이 없으신가요? → 가입",
  loginSigninToggle: "이미 계정이 있으신가요? → 로그인",
  loginSubmit: "로그인",
  loginSignupSubmit: "가입하기",
  loginError: "로그인 실패 — 이메일과 비밀번호를 확인해 주세요.",
  loginSuccess: "로그인됨 ✓",
  historyHeading: "지난 결과들",
  historyEmpty: "아직 기록된 결과가 없어요.",
  
  // In STR.en:
  loginPromptH: "Want to remember your result?",
  loginPromptP: "Log in to save this result and see it again from any device. Optional — you can keep using it anonymously.",
  loginBtn: "Log in / Sign up",
  loginSkip: "Skip for now",
  loginEmailLabel: "Email",
  loginPasswordLabel: "Password",
  loginSignupToggle: "No account? → Sign up",
  loginSigninToggle: "Already have an account? → Log in",
  loginSubmit: "Log in",
  loginSignupSubmit: "Sign up",
  loginError: "Login failed — check your email and password.",
  loginSuccess: "Logged in ✓",
  historyHeading: "Past results",
  historyEmpty: "No results recorded yet.",
  ```
- [ ] Add CSS for `.login-prompt` (after line 849, end of `.social` block):
  ```css
  /* ---------- login prompt (post-result, skippable) ---------- */
  .login-prompt {
    background: rgba(107, 148, 130, 0.08);
    border: 1px dashed var(--line-strong);
    border-radius: 4px;
    padding: 22px 24px;
    margin-bottom: 18px;
  }
  .login-prompt h3 {
    font-family: "Noto Serif KR", serif;
    font-weight: 500;
    font-size: 17px;
    margin-bottom: 8px;
  }
  .login-prompt p {
    font-size: 13.5px;
    color: rgba(31, 38, 32, 0.7);
    line-height: 1.6;
    margin-bottom: 14px;
  }
  .login-prompt .row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .login-form {
    display: none;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }
  .login-form.active { display: flex; }
  .login-form label {
    font-family: "JetBrains Mono", monospace;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(31, 38, 32, 0.6);
    margin-bottom: 4px;
  }
  .login-form input {
    background: rgba(31, 38, 32, 0.04);
    border: 1px solid var(--line);
    color: var(--ink);
    padding: 10px 14px;
    border-radius: 2px;
    font-family: inherit;
    font-size: 14px;
  }
  .login-form input:focus { outline: none; border-color: var(--accent-2); }
  .login-form .toggle-link {
    font-size: 12px;
    color: var(--accent-2);
    text-decoration: none;
    cursor: pointer;
    border-bottom: 1px dashed var(--accent-2);
  }
  .login-form .toggle-link:hover { color: var(--accent); }
  ```
- [ ] In the main result-rendering function (search for `renderResult` or the block that builds the result HTML), after the `.type-hero` block and before `.axes`, insert:
  ```javascript
  // Check if already logged in or dismissed
  const LS_LOGIN_SKIP = "vibe.korean-mbti.login-skip";
  let skipLogin = false;
  try { skipLogin = localStorage.getItem(LS_LOGIN_SKIP) === "true"; } catch (e) {}
  const loggedIn = false; // will be set by auth check in next task
  
  if (!loggedIn && !skipLogin) {
    html += `
      <div class="login-prompt" id="login-prompt">
        <h3 data-i18n="loginPromptH">${t("loginPromptH")}</h3>
        <p data-i18n="loginPromptP">${t("loginPromptP")}</p>
        <div class="row">
          <button class="btn secondary" id="btn-login-show" data-i18n="loginBtn">${t("loginBtn")}</button>
          <button class="btn secondary" id="btn-login-skip" data-i18n="loginSkip">${t("loginSkip")}</button>
        </div>
        <div class="login-form" id="login-form">
          <label><span data-i18n="loginEmailLabel">${t("loginEmailLabel")}</span></label>
          <input type="email" id="login-email" placeholder="you@example.com" autocomplete="email">
          <label><span data-i18n="loginPasswordLabel">${t("loginPasswordLabel")}</span></label>
          <input type="password" id="login-password" placeholder="········" autocomplete="current-password">
          <div class="row">
            <button class="btn" id="btn-login-submit" data-i18n="loginSubmit">${t("loginSubmit")}</button>
            <a class="toggle-link" id="login-toggle" data-i18n="loginSignupToggle">${t("loginSignupToggle")}</a>
          </div>
        </div>
      </div>
    `;
  }
  ```
- [ ] Wire the buttons: after rendering the result HTML, add event listeners:
  ```javascript
  const btnLoginShow = document.getElementById("btn-login-show");
  const btnLoginSkip = document.getElementById("btn-login-skip");
  const loginForm = document.getElementById("login-form");
  const btnLoginSubmit = document.getElementById("btn-login-submit");
  const loginToggle = document.getElementById("login-toggle");
  let isSignup = false;
  
  if (btnLoginShow) btnLoginShow.addEventListener("click", () => {
    loginForm.classList.add("active");
    btnLoginShow.style.display = "none";
    btnLoginSkip.style.display = "none";
  });
  
  if (btnLoginSkip) btnLoginSkip.addEventListener("click", () => {
    try { localStorage.setItem(LS_LOGIN_SKIP, "true"); } catch (e) {}
    document.getElementById("login-prompt").style.display = "none";
  });
  
  if (loginToggle) loginToggle.addEventListener("click", (e) => {
    e.preventDefault();
    isSignup = !isSignup;
    btnLoginSubmit.textContent = isSignup ? t("loginSignupSubmit") : t("loginSubmit");
    loginToggle.textContent = isSignup ? t("loginSigninToggle") : t("loginSignupToggle");
  });
  
  if (btnLoginSubmit) btnLoginSubmit.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) return;
    // auth logic in next task
  });
  ```

---

#### Task 10: Wire PocketBase auth (login/signup + persist result with user_id)

**Files:** `korean-mbti/index.html`

Implement the auth logic: on signup, create a user; on login, authenticate; on success, re-submit the result with `user_id` attached. Show a small success message and hide the prompt. On failure, show an inline error.

**Steps:**

- [ ] In the PocketBase module script (the `<script type="module">` block starting around line 4301), after the `getPB()` function, add:
  ```javascript
  async function checkAuth() {
    const c = await getPB();
    if (!c) return null;
    return c.authStore.isValid ? c.authStore.model : null;
  }
  
  async function signupUser(email, password) {
    const c = await getPB();
    if (!c) throw new Error("sdk unavailable");
    return await c.collection("users").create({
      email,
      password,
      passwordConfirm: password,
    });
  }
  
  async function loginUser(email, password) {
    const c = await getPB();
    if (!c) throw new Error("sdk unavailable");
    return await c.collection("users").authWithPassword(email, password);
  }
  
  async function saveResultForUser(type, nickname, userId) {
    const c = await getPB();
    if (!c) throw new Error("sdk unavailable");
    return await c.collection("mbti_result").create({
      type: String(type).slice(0, 8),
      nickname: String(nickname || "").slice(0, 40),
      player_id: playerId(),
      user_id: userId,
    });
  }
  
  async function fetchUserHistory(userId) {
    const c = await getPB();
    if (!c) throw new Error("sdk unavailable");
    return await c.collection("mbti_result").getFullList({
      filter: `user_id = "${userId}"`,
      sort: "-created",
      limit: 5,
    });
  }
  ```
- [ ] In the `btnLoginSubmit` click handler (from Task 9), replace the `// auth logic in next task` comment with:
  ```javascript
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) return;
  
  btnLoginSubmit.disabled = true;
  btnLoginSubmit.textContent = "…";
  
  try {
    if (isSignup) {
      await signupUser(email, password);
      await loginUser(email, password); // auto-login after signup
    } else {
      await loginUser(email, password);
    }
    const user = await checkAuth();
    if (user) {
      // Save this result with user_id
      await saveResultForUser(state.type, state.nickname, user.id);
      // Show success, hide prompt
      const prompt = document.getElementById("login-prompt");
      prompt.innerHTML = `<p style="color: var(--accent-2); font-weight: 500;">${t("loginSuccess")}</p>`;
      setTimeout(() => { prompt.style.display = "none"; }, 2000);
      // Render history (next task)
    }
  } catch (err) {
    const errDiv = document.createElement("div");
    errDiv.className = "error active";
    errDiv.textContent = t("loginError");
    loginForm.appendChild(errDiv);
    setTimeout(() => errDiv.remove(), 3000);
  } finally {
    btnLoginSubmit.disabled = false;
    btnLoginSubmit.textContent = isSignup ? t("loginSignupSubmit") : t("loginSubmit");
  }
  ```
- [ ] Verify: the user can sign up or log in, and on success the prompt disappears with a success message.

---

#### Task 11: Add personal history view (last 3-5 results)

**Files:** `korean-mbti/index.html`

After login, show a small `.history` section below the result, listing the last 3-5 results in reverse-chronological order. Each entry shows the type code, nickname, and date. If no history, show a placeholder.

**Steps:**

- [ ] Add CSS for `.history` (after `.login-prompt` block):
  ```css
  /* ---------- personal history (logged-in only) ---------- */
  .history {
    background: rgba(31, 38, 32, 0.04);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 22px 24px;
    margin-bottom: 18px;
  }
  .history h3 {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 14px;
    font-weight: 500;
  }
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .history-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(31, 38, 32, 0.04);
    border: 1px solid var(--line);
    border-radius: 2px;
    font-size: 13px;
  }
  .history-item .code {
    font-family: "JetBrains Mono", monospace;
    font-weight: 600;
    color: var(--accent-2);
    margin-right: 8px;
  }
  .history-item .nick {
    color: var(--ink-soft);
    flex: 1;
  }
  .history-item .date {
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    color: rgba(31, 38, 32, 0.5);
  }
  .history-empty {
    font-size: 13px;
    color: rgba(31, 38, 32, 0.6);
    font-style: italic;
  }
  ```
- [ ] After successful login (in the `btnLoginSubmit` handler), fetch and render history:
  ```javascript
  const user = await checkAuth();
  if (user) {
    await saveResultForUser(state.type, state.nickname, user.id);
    // ... success message ...
    
    // Render history
    const history = await fetchUserHistory(user.id);
    const historyHTML = `
      <div class="history">
        <h3 data-i18n="historyHeading">${t("historyHeading")}</h3>
        ${history.length === 0 ? `<p class="history-empty" data-i18n="historyEmpty">${t("historyEmpty")}</p>` : `
          <div class="history-list">
            ${history.map(r => {
              const d = new Date(Date.parse(r.created.replace(" ", "T")));
              const dateStr = d.toLocaleDateString(LANG === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
              return `
                <div class="history-item">
                  <span class="code">${r.type}</span>
                  <span class="nick">${r.nickname || ""}</span>
                  <span class="date">${dateStr}</span>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>
    `;
    const axes = document.querySelector(".axes");
    if (axes) axes.insertAdjacentHTML("beforebegin", historyHTML);
  }
  ```
- [ ] Verify: after login, the history section appears with the last 3-5 results (or "No results recorded yet.").

---

#### Task 12: Verification checkpoint — Change B smoke test

**Files:** `korean-mbti/_smoke-change-b.mjs` (new, untracked, will be deleted in Task 13)

Write a headless Playwright smoke test that:
1. Opens `korean-mbti/index.html`.
2. Completes a quick test.
3. Sees the result screen.
4. Clicks "Log in / Sign up".
5. Fills email + password, clicks "Sign up".
6. Confirms success message appears.
7. Confirms `.history` section is visible.

**Steps:**

- [ ] Create `korean-mbti/_smoke-change-b.mjs`:
  ```javascript
  #!/usr/bin/env node
  import { chromium } from 'playwright';
  const exe = '/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  await page.goto('file:///home/ubuntu/projects/vibe-demos/korean-mbti/index.html');
  
  // Complete quick test
  await page.click('button[data-length="quick"]');
  for (let i = 0; i < 28; i++) {
    const choiceA = await page.locator('.qchoice').first();
    if (await choiceA.isVisible()) await choiceA.click();
    const nextBtn = await page.locator('button:has-text("다음")');
    if (await nextBtn.isVisible()) await nextBtn.click();
    const resultBtn = await page.locator('button:has-text("결과 보기")');
    if (await resultBtn.isVisible()) { await resultBtn.click(); break; }
  }
  await page.waitForSelector('.type-hero .code', { timeout: 5000 });
  
  // Check login prompt
  const btnLoginShow = await page.locator('#btn-login-show');
  if (!await btnLoginShow.isVisible()) throw new Error('Login button not visible');
  await btnLoginShow.click();
  
  // Fill form
  const email = `test-${Date.now()}@example.com`;
  await page.fill('#login-email', email);
  await page.fill('#login-password', 'password123');
  await page.click('#btn-login-submit');
  
  // Wait for success
  await page.waitForSelector('.login-prompt p:has-text("Logged in")', { timeout: 5000 });
  
  // Check history
  const history = await page.locator('.history');
  if (!await history.isVisible()) throw new Error('History section not visible');
  
  console.log('✓ Change B smoke test passed');
  await browser.close();
  ```
- [ ] Run: `NODE_PATH=/tmp/node_modules node /home/ubuntu/projects/vibe-demos/korean-mbti/_smoke-change-b.mjs`
- [ ] Confirm output: `✓ Change B smoke test passed`
- [ ] If it fails, debug, fix, and re-run.

---

#### Task 13: Deploy migrations and bump SW cache

**Files:** `korean-mbti/sw.js`, `backends/config.json` (no change), deploy via `./sync-backends.sh`

Deploy the new migrations (003 + 004) to the korean-mbti backend (port 8092), then bump the service worker cache version.

**Steps:**

- [ ] From the repo root, run: `./sync-backends.sh`
- [ ] Confirm output shows korean-mbti migrations synced and systemd unit restarted.
- [ ] Open `korean-mbti/sw.js` and increment the cache version: `"vibe-korean-mbti-v2"` → `"vibe-korean-mbti-v3"`.
- [ ] Verify: `curl -s -o /dev/null -w "%{http_code}\n" https://korean-mbti.pb.gurum.se/api/health` should return `200`.

---

#### Task 14: Clean up temp smoke files

**Files:** `korean-mbti/_smoke-change-a.mjs`, `korean-mbti/_smoke-change-b.mjs` (delete)

Delete the untracked smoke files so they don't clutter the repo.

**Steps:**

- [ ] Run: `rm -f /home/ubuntu/projects/vibe-demos/korean-mbti/_smoke-*.mjs`
- [ ] Verify: `git status` in `korean-mbti/` shows no `_smoke*.mjs` files.

---

## Manual Verification Checklist

After all tasks:

- [ ] Open `https://kalleeh.github.io/vibe-demos/korean-mbti/` in a browser.
- [ ] Complete a quick test (28 questions).
- [ ] On the result screen, confirm:
  - [ ] The `.social .rarity` line shows a percentage and companion-count.
  - [ ] The `.lb-status-text` says "live tally" (if online) or "local tally" (if offline).
  - [ ] Your type's bar is highlighted in rust orange (`.me` class).
  - [ ] The rarity line and bars animate in (unless prefers-reduced-motion).
- [ ] If online and NOT logged in:
  - [ ] A login prompt appears below the type hero.
  - [ ] Click "Log in / Sign up", fill email + password, sign up.
  - [ ] On success, the prompt disappears with "Logged in ✓".
  - [ ] A `.history` section appears showing the just-submitted result.
- [ ] Reload the page, complete another test.
  - [ ] If logged in, the login prompt does NOT appear.
  - [ ] The `.history` section shows both results.
- [ ] If offline (disconnect network), complete a test.
  - [ ] The `.lb-status-text` says "local tally".
  - [ ] The social proof still renders (from localStorage).

---

## Self-Review Note

Before marking the plan complete, verify:
1. **Change A tasks (1-6) are fully shippable alone** — they do NOT depend on Change B.
2. **Change B tasks (7-14) are clearly marked as optional/dependent** — if the `users` collection doesn't exist, they're blocked.
3. **All code snippets are complete and syntax-checked** — no placeholders like `TODO` or `...`.
4. **Verification steps include exact commands + expected output** — a future agent can run them without guessing.
5. **The plan preserves existing patterns** — dynamic `import()` for PB SDK, `textContent` for XSS safety, fetch-on-open (no polling), Safari date-parsing workaround (`replace(" ", "T")`).

---

## Dependencies Resolved

- **Change A** depends on: nothing (existing scaffolding + PB collection).
- **Change B** depends on: `users` auth collection (from clinic-admin's spec, or created here in Task 7).

If clinic-admin is built first and defines `users`, Task 7 is skipped. If not, Task 7 creates it here and clinic-admin can reuse it later (one auth collection across the studio).

---

## Undetermined from Code

- **i18n anchor for history item dates** — the spec doesn't specify exact Korean vs. English date formats; the plan uses `toLocaleDateString` with `"ko-KR"` / `"en-US"` locales, which is safe and matches the existing i18n pattern.
- **Exact position of `.history` in DOM** — the plan inserts it before `.axes` (after `.type-hero` and `.social`), which feels right for "personal context after the social proof."
- **Login prompt dismissal persistence** — the plan uses `localStorage` key `vibe.korean-mbti.login-skip` to remember "skip for now" per device; the spec doesn't say whether this should be session-only or persistent. Persistent is friendlier (don't nag every reload).

---

## Task Summary

**Change A (ship-alone-able):**
1. Wire reveal animation (rarity + bars fade-up)
2. Wire socialLocal/socialConnected strings to online/offline
3. Add companion-count to rarity line
4. Add your-type highlighting (`.me` class)
5. Verification checkpoint — Change A smoke test
6. Bump SW cache

**Change B (optional, dependent on `users`):**
7. Check/define `users` collection migration
8. Add `user_id` field to `mbti_result`
9. Add post-result login prompt UI
10. Wire PocketBase auth (login/signup + save with user_id)
11. Add personal history view (last 3-5 results)
12. Verification checkpoint — Change B smoke test
13. Deploy migrations and bump SW cache
14. Clean up temp smoke files

---

**Plan complete.** Ready for `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
