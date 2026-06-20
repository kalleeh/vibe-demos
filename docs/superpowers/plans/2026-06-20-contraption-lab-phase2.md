# Contraption Lab — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional PocketBase accounts to `contraption-lab/` so a signed-in player's level progress (solved + best part-count + best time) syncs across devices and feeds a public per-level leaderboard — while the game stays 100% playable signed-out (local-first).

**Architecture:** A new `contraption-lab/pb/pb_migrations/001_init_progress.js` migration adds one `progress` collection (relation to the built-in `users` auth collection, unique per user+level) deployed to the shared `pb-backends` box on port 8100. The frontend gains a thin `js/cloud.js` module (PocketBase SDK via CDN importmap, health-checked, never blocking) and a `js/auth-ui.js` panel; `progress.js` already exposes the pure `mergeProgress` used to reconcile local and remote. `onWin` mirrors a solve to the cloud when signed in; the level menu and a new leaderboard overlay read from it. Everything degrades to the existing localStorage behavior when signed out or offline.

**Tech Stack:** PocketBase 0.25.8 server (existing `pb-backends`), PocketBase JS SDK 0.26.2 (CDN ESM, pinned), vanilla ES modules, the existing Phase-1 `contraption-lab/js/` modules.

## Global Constraints

- Static frontend only: NO build tool, NO framework, NO package.json, NO bundler. `sync-backends.sh` is the backend deploy, NOT a frontend build. (verbatim: "Do not introduce a build tool, framework, or package.json.")
- **Local-first, non-negotiable:** the game MUST be fully playable with NO backend and signed out. PocketBase enhances, never gates. (verbatim: "Do not make PocketBase required for the demo to load. Always fall back to local data.")
- PocketBase URL is baked in as a constant: `const PB_URL = "https://contraption-lab.pb.gurum.se";` — NO bring-your-own-URL. (verbatim: "Do NOT use a BYO-URL pattern.")
- SDK pinned EXACTLY to `pocketbase@0.26.2` via CDN ESM importmap — never `@latest`.
- Port **8100** in `backends/config.json` (8091–8099 taken; never reuse).
- The default PB `users` auth collection ALREADY EXISTS on a fresh 0.25.8 instance — the migration MUST `app.findCollectionByNameOrId("users")` and reference its `.id` in the relation; it MUST NOT create a `users` collection.
- Collection names singular snake_case; migration files `NNN_<desc>.js`, sequential, never renumbered.
- Health check only on user actions / open — NO reconnection polling. (verbatim: "Do NOT implement reconnection polling.")
- Render any user-supplied field with `textContent`, never `innerHTML`. (verbatim: "Do NOT use innerHTML with user-submitted PocketBase fields.")
- `sw.js` MUST keep skipping cross-origin fetches (already does) so PB calls aren't cached.
- Access control is via collection API rules, not keys. (verbatim: "Do not rely on API keys in the frontend.")
- Before writing the migration/SDK code, the implementer of Tasks 1 and 4 should trust the verified syntax in this plan; it was confirmed against Context7 + a live PB 0.25.8 on 2026-06-20.

**Work happens on a new branch `feat/contraption-lab-phase2` off `main`.**

---

## File Structure

```
contraption-lab/
├── pb/pb_migrations/001_init_progress.js   ← NEW: progress collection (relation to users, unique idx)
├── js/
│   ├── cloud.js        ← NEW: PB client, health, auth (signup/login/logout), progress push/pull, leaderboard read
│   ├── auth-ui.js      ← NEW: account panel (sign in / create / sign out) + online·local indicator wiring
│   ├── progress.js     ← MODIFY: add pullAndMerge() helper that merges a remote map into local via mergeProgress
│   ├── main.js         ← MODIFY: boot cloud, wire onWin→cloud push, add leaderboard button, account button
│   ├── cloud.test.js   ← NEW: pure-logic tests (record→progress-map shaping, best-of compare) run via ?test
│   └── level.test.js   ← MODIFY: include cloudCases() in the ?test run
├── index.html          ← MODIFY: add importmap (pocketbase), account + leaderboard buttons, two <dialog>s, indicator
├── style.css           ← MODIFY: styles for account panel, leaderboard overlay, online/local dot
backends/config.json    ← MODIFY: add "contraption-lab": { "port": 8100 }
```

Dependency/task order: migration → config → deploy → cloud.js (client+auth+data) → progress.pullAndMerge → auth-ui → main.js wiring → leaderboard overlay → README/CLAUDE sync + live verify.

A note on the data model (decided during research): **the `progress` collection IS the leaderboard.** One record per (user, level) holds `solved`, `best_parts`, `best_ms`. Public read (so anyone sees the leaderboard), owner-only create/update (so players only edit their own). A per-level leaderboard is just `getList` on `progress` filtered by `level_id`, sorted by `best_parts` then `best_ms`, expanding the user relation for the display name.

---

### Task 1: progress collection migration

**Files:**
- Create: `contraption-lab/pb/pb_migrations/001_init_progress.js`

**Interfaces:**
- Produces: a `progress` base collection with fields `user` (relation→users, required, single, cascadeDelete), `level_id` (text, required, max 40), `solved` (bool), `best_parts` (number, min 0), `best_ms` (number, min 0), plus a UNIQUE index on `(user, level_id)`. Rules: list/view = `""` (public read), create = `@request.auth.id != "" && user = @request.auth.id`, update = `user = @request.auth.id`, delete = `null`. This is the contract the SDK code in Task 4 writes against.

- [ ] **Step 1: Write the migration file**

```js
// contraption-lab/pb/pb_migrations/001_init_progress.js
// Verified against PocketBase 0.25.8 + Context7 (2026-06-20).
// The default `users` auth collection already exists — we reference it, never create it.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    type: "base",
    name: "progress",
    // Public read so leaderboards are visible to everyone (signed in or not).
    listRule: "",
    viewRule: "",
    // Only a signed-in user may create their own row, and only update their own.
    createRule: "@request.auth.id != \"\" && user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: null,
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text",   name: "level_id",   required: true, max: 40 },
      { type: "bool",   name: "solved" },
      { type: "number", name: "best_parts", min: 0 },
      { type: "number", name: "best_ms",    min: 0 },
      // PB 0.25 base collections do NOT auto-create created/updated — declare them.
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });

  app.save(collection);

  // One row per (user, level) — enforced at the DB so best-of upserts can't duplicate.
  collection.addIndex("idx_progress_user_level", true, "(user, level_id)", "");
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("progress");
  app.delete(collection);
});
```

- [ ] **Step 2: Syntax-check the migration as JS**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos && node --check contraption-lab/pb/pb_migrations/001_init_progress.js && echo "migration syntax OK"
```
Expected: `migration syntax OK`. (`migrate`/`Collection` are PB JSVM globals — `node --check` validates syntax only, which is all we can do without the PB runtime.)

- [ ] **Step 3: Apply the migration against a local throwaway PocketBase 0.25.8 to prove it runs**

Run (downloads the exact server version into /tmp, applies migrations, asserts the collection + unique index exist — NOTHING touches the real server):
```bash
cd /tmp && rm -rf pbverify && mkdir pbverify && cd pbverify
curl -sL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v0.25.8/pocketbase_0.25.8_linux_amd64.zip" && unzip -q pb.zip
mkdir -p pb_migrations && cp /home/ubuntu/projects/vibe-demos/contraption-lab/pb/pb_migrations/001_init_progress.js pb_migrations/
./pocketbase migrate up --dir=/tmp/pbverify/pb_data --migrationsDir=/tmp/pbverify/pb_migrations 2>&1 | tail -5
```
Expected: output reporting the `001_init_progress` migration applied with no error (e.g. `Applied .../001_init_progress.js`).

- [ ] **Step 4: Assert the collection + unique index landed**

Run:
```bash
cd /tmp/pbverify
./pocketbase serve --http=127.0.0.1:8395 --dir=/tmp/pbverify/pb_data >/tmp/pbverify/s.log 2>&1 &
sleep 4
echo "y" | ./pocketbase migrate collections --dir=/tmp/pbverify/pb_data >/dev/null 2>&1
SNAP=$(ls -t pb_migrations/*collections_snapshot.js | head -1)
echo "progress collection: $(grep -c '"name": "progress"' "$SNAP")"
echo "unique index:        $(grep -c 'idx_progress_user_level' "$SNAP")"
kill %1 2>/dev/null
```
Expected: `progress collection: 1` and `unique index: 1`. If either is 0, fix the migration and repeat from Step 3.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/pb/pb_migrations/001_init_progress.js
git commit -m "contraption-lab: PocketBase progress collection migration (Phase 2)"
```

---

### Task 2: register the backend in config + deploy

**Files:**
- Modify: `backends/config.json`

**Interfaces:**
- Produces: the backend live at `https://contraption-lab.pb.gurum.se` on port 8100, with the `progress` collection from Task 1.

- [ ] **Step 1: Add the port entry**

Edit `backends/config.json` — add to the `"backends"` object after `"ai": { "port": 8099 }`:
```json
    "ai": { "port": 8099 },
    "contraption-lab": { "port": 8100 }
```
(ensure the preceding line keeps its comma and JSON stays valid).

- [ ] **Step 2: Validate JSON**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos && jq -e '.backends["contraption-lab"].port == 8100' backends/config.json && echo "config OK"
```
Expected: `true` then `config OK`.

- [ ] **Step 3: Deploy the backend**

Run (this rsyncs migrations to `pb-backends`, provisions the systemd unit + Caddy route, applies migrations):
```bash
cd /home/ubuntu/projects/vibe-demos && ./sync-backends.sh 2>&1 | tail -20
```
Expected: output mentioning `contraption-lab` provisioned/synced with no error.

- [ ] **Step 4: Verify the live backend is up and the collection is queryable**

Run:
```bash
echo "health: $(curl -s -o /dev/null -w '%{http_code}' https://contraption-lab.pb.gurum.se/api/health)"
echo "progress list (public read, expect 200 + items array): $(curl -s 'https://contraption-lab.pb.gurum.se/api/collections/progress/records?perPage=1' | head -c 120)"
```
Expected: `health: 200`, and the progress list returns a JSON object containing `"items"` (empty list is fine) — NOT a 404 (which would mean the collection didn't deploy).

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add backends/config.json
git commit -m "contraption-lab: register backend on port 8100 + deploy"
```

---

### Task 3: pullAndMerge helper in progress.js

**Files:**
- Modify: `contraption-lab/js/progress.js`
- Modify: `contraption-lab/js/level.test.js` (add `cloudCases` import wiring is Task 6; here add progress-merge cases)

**Interfaces:**
- Consumes: existing `mergeProgress(a,b)`, `getProgress()` from progress.js.
- Produces:
  - `progressToRecords(map, userId)` → array of `{user, level_id, solved, best_parts, best_ms}` bodies (one per solved level) ready for PB create/update. Pure.
  - `recordsToProgress(records)` → a progress map `{ [level_id]: {solved, bestParts, bestMs} }` from PB records (each record has `level_id, solved, best_parts, best_ms`). Pure.
  - `applyRemote(remoteMap)` → merges remoteMap into local storage via `mergeProgress(getProgress(), remoteMap)`, persists, returns the merged map. (localStorage side-effect; tested in browser only.)

- [ ] **Step 1: Add failing pure-logic tests to level.test.js**

Append to `contraption-lab/js/level.test.js`:
```js
export async function progressShapeCases() {
  const P = await import("./progress.js");
  return [
    { name:"recordsToProgress shapes a map", fn:()=>{
        const m = P.recordsToProgress([{level_id:"official-01",solved:true,best_parts:2,best_ms:5000}]);
        if(!m["official-01"] || m["official-01"].bestParts!==2 || m["official-01"].bestMs!==5000) throw new Error("bad shape "+JSON.stringify(m));
      }},
    { name:"progressToRecords emits solved rows with user", fn:()=>{
        const rows = P.progressToRecords({ "official-01":{solved:true,bestParts:2,bestMs:5000}, "official-02":{solved:false} }, "U1");
        if(rows.length!==1) throw new Error("expected 1 solved row, got "+rows.length);
        if(rows[0].user!=="U1" || rows[0].level_id!=="official-01" || rows[0].best_parts!==2) throw new Error("bad row "+JSON.stringify(rows[0]));
      }},
    { name:"round-trip records→map→records is stable", fn:()=>{
        const recs=[{level_id:"official-03",solved:true,best_parts:1,best_ms:999}];
        const back=P.progressToRecords(P.recordsToProgress(recs),"U1");
        if(back[0].level_id!=="official-03"||back[0].best_parts!==1||back[0].best_ms!==999) throw new Error("lost data "+JSON.stringify(back));
      }},
  ];
}
```

- [ ] **Step 2: Run to verify FAIL**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && node --input-type=module -e "import('./js/level.test.js').then(async m=>{const r=m.runTests(await m.progressShapeCases());process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: FAIL — `recordsToProgress is not a function` (or the case assertions throw).

- [ ] **Step 3: Implement the helpers in progress.js**

Append to `contraption-lab/js/progress.js`:
```js
// --- Phase 2: cloud sync shaping (pure) ---

// PB records → local progress map. Each record: {level_id, solved, best_parts, best_ms}.
export function recordsToProgress(records = []) {
  const out = {};
  for (const r of records) {
    out[r.level_id] = { solved: !!r.solved, bestParts: r.best_parts ?? Infinity, bestMs: r.best_ms ?? Infinity };
  }
  return out;
}

// Local progress map → PB record bodies (only solved levels are worth syncing).
export function progressToRecords(map = {}, userId) {
  const rows = [];
  for (const [level_id, e] of Object.entries(map)) {
    if (!e || !e.solved) continue;
    rows.push({ user: userId, level_id, solved: true, best_parts: e.bestParts, best_ms: e.bestMs });
  }
  return rows;
}

// Merge a remote map into local storage (best-of), persist, return merged map.
export function applyRemote(remoteMap = {}) {
  const merged = mergeProgress(getProgress(), remoteMap);
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
  return merged;
}
```

> Note: `KEY` and `mergeProgress`/`getProgress` are already defined at the top of progress.js from Phase 1 — these helpers reuse them. Do not redefine them.

- [ ] **Step 4: Run to verify PASS**

Run the Step 2 command.
Expected: `3 passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/progress.js contraption-lab/js/level.test.js
git commit -m "contraption-lab: progress↔PB record shaping helpers + applyRemote"
```

---

### Task 4: cloud.js — PB client, auth, sync, leaderboard

**Files:**
- Create: `contraption-lab/js/cloud.js`
- Create: `contraption-lab/js/cloud.test.js`
- Modify: `contraption-lab/index.html` (add the importmap so `import "pocketbase"` resolves)

**Interfaces:**
- Consumes: `progressToRecords`, `recordsToProgress`, `applyRemote` (progress.js); `getProgress` (progress.js); PocketBase SDK (CDN).
- Produces a module with:
  - `cloud.available` — bool, true once `init()` confirmed health.
  - `cloud.user()` — `{id, name, email}` or null (from authStore).
  - `init()` → dynamically imports the SDK, constructs `pb`, runs `pb.health.check()` (sets `available`), returns bool. Never throws.
  - `signup(email, password, name)` → creates a users record then logs in; returns `{ok}` or `{ok:false, error}`.
  - `login(email, password)` → `authWithPassword`; returns `{ok}` or `{ok:false, error}`.
  - `logout()` → clears authStore.
  - `pushProgress(map)` → for each solved level, upsert a `progress` row (getFirstListItem by user+level → update best-of, else create). Best-of computed locally before write. No-op if not signed in / unavailable.
  - `pullProgress()` → getFullList of this user's `progress` rows → `recordsToProgress` → `applyRemote`; returns merged map (or current local on failure).
  - `leaderboard(levelId, limit=25)` → getList on `progress` filtered `level_id="..." && solved=true`, sort `best_parts,best_ms`, `expand:"user"`; returns `[{name, parts, ms, isMe}]`. Returns `[]` on failure.
- The importmap pins `pocketbase@0.26.2`.

- [ ] **Step 1: Add the importmap to index.html `<head>`**

Insert immediately AFTER the `<script src="./vendor/matter.min.js"></script>` line in `contraption-lab/index.html`:
```html
  <script type="importmap">
    { "imports": { "pocketbase": "https://cdn.jsdelivr.net/npm/pocketbase@0.26.2/dist/pocketbase.es.mjs" } }
  </script>
```

- [ ] **Step 2: Write failing pure-logic tests in cloud.test.js**

```js
// contraption-lab/js/cloud.test.js
// Pure transforms only — the network/auth methods are verified in-browser (Task 9).
export async function cloudCases() {
  const C = await import("./cloud.js");
  return [
    { name:"leaderboardRows maps + flags me", fn:()=>{
        const rows = C.leaderboardRows(
          [ {best_parts:1,best_ms:100,expand:{user:{id:"A",name:"Ada"}}},
            {best_parts:2,best_ms:50, expand:{user:{id:"B",name:"Boo"}}} ], "B");
        if(rows.length!==2) throw new Error("len "+rows.length);
        if(rows[0].name!=="Ada"||rows[0].parts!==1) throw new Error("row0 "+JSON.stringify(rows[0]));
        if(!rows[1].isMe) throw new Error("me-flag missing");
      }},
    { name:"leaderboardRows falls back to Anon name", fn:()=>{
        const rows = C.leaderboardRows([{best_parts:1,best_ms:1,expand:{}}], null);
        if(rows[0].name!=="Anonymous") throw new Error("name "+rows[0].name);
      }},
    { name:"bestOf keeps lower parts then lower ms", fn:()=>{
        if(C.bestOf({best_parts:3,best_ms:100},{best_parts:2,best_ms:999}).best_parts!==2) throw new Error("parts");
        if(C.bestOf({best_parts:2,best_ms:100},{best_parts:2,best_ms:40}).best_ms!==40) throw new Error("ms");
      }},
  ];
}
```

- [ ] **Step 3: Run to verify FAIL**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && node --input-type=module -e "import('./js/cloud.test.js').then(async m=>{const t=await import('./js/level.test.js');const r=t.runTests(await m.cloudCases());process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: FAIL — `LOAD FAIL ... cloud.js` (module not created yet).

> Note: cloud.js does `import PocketBase from "pocketbase"` at top level, which Node can't resolve (bare specifier). To keep the pure helpers testable in Node, cloud.js MUST NOT statically import the SDK — it dynamically `import("pocketbase")` inside `init()` only. The pure helpers (`leaderboardRows`, `bestOf`) must be importable without the SDK. Implement accordingly in Step 4.

- [ ] **Step 4: Implement cloud.js**

```js
// contraption-lab/js/cloud.js
// Local-first cloud layer. The game works fully without any of this.
// SDK is dynamically imported inside init() so pure helpers stay Node-testable.
import { progressToRecords, recordsToProgress, applyRemote, getProgress } from "./progress.js";

const PB_URL = "https://contraption-lab.pb.gurum.se";

let pb = null;
export const cloud = { available: false };

export async function init() {
  try {
    const mod = await import("pocketbase");
    const PocketBase = mod.default;
    pb = new PocketBase(PB_URL);              // authStore auto-persists in localStorage
    await pb.health.check();
    cloud.available = true;
  } catch { cloud.available = false; }
  return cloud.available;
}

export function user() {
  if (!pb || !pb.authStore?.isValid) return null;
  const m = pb.authStore.record || pb.authStore.model;
  return m ? { id: m.id, name: m.name || "", email: m.email || "" } : null;
}

export async function signup(email, password, name) {
  if (!pb) return { ok:false, error:"offline" };
  try {
    await pb.collection("users").create({ email, password, passwordConfirm: password, name: name || email.split("@")[0] });
    await pb.collection("users").authWithPassword(email, password);
    return { ok:true };
  } catch (e) { return { ok:false, error: humanError(e) }; }
}

export async function login(email, password) {
  if (!pb) return { ok:false, error:"offline" };
  try { await pb.collection("users").authWithPassword(email, password); return { ok:true }; }
  catch (e) { return { ok:false, error: humanError(e) }; }
}

export function logout() { if (pb) pb.authStore.clear(); }

// best-of of two PB-shaped progress bodies (lower parts, then lower ms wins)
export function bestOf(a, b) {
  if (!a) return b; if (!b) return a;
  const better = (b.best_parts < a.best_parts) || (b.best_parts === a.best_parts && b.best_ms < a.best_ms) ? b : a;
  return { ...better, solved: (a.solved || b.solved) };
}

export async function pushProgress(map) {
  const u = user(); if (!pb || !cloud.available || !u) return;
  const rows = progressToRecords(map, u.id);
  for (const row of rows) {
    try {
      const existing = await pb.collection("progress").getFirstListItem(
        `user="${u.id}" && level_id="${row.level_id}"`).catch(() => null);
      if (existing) {
        const merged = bestOf(existing, row);
        if (merged.best_parts !== existing.best_parts || merged.best_ms !== existing.best_ms || merged.solved !== existing.solved)
          await pb.collection("progress").update(existing.id, { solved: merged.solved, best_parts: merged.best_parts, best_ms: merged.best_ms });
      } else {
        await pb.collection("progress").create(row);
      }
    } catch { /* non-blocking: a failed sync never breaks play */ }
  }
}

export async function pullProgress() {
  const u = user(); if (!pb || !cloud.available || !u) return getProgress();
  try {
    const records = await pb.collection("progress").getFullList({ filter: `user="${u.id}"` });
    return applyRemote(recordsToProgress(records));
  } catch { return getProgress(); }
}

// PB records → display rows for the leaderboard overlay
export function leaderboardRows(records = [], meId = null) {
  return records.map(r => ({
    name: (r.expand && r.expand.user && r.expand.user.name) ? r.expand.user.name : "Anonymous",
    parts: r.best_parts, ms: r.best_ms,
    isMe: !!(meId && r.expand && r.expand.user && r.expand.user.id === meId),
  }));
}

export async function leaderboard(levelId, limit = 25) {
  if (!pb || !cloud.available) return [];
  try {
    const res = await pb.collection("progress").getList(1, limit, {
      filter: `level_id="${levelId}" && solved=true`, sort: "best_parts,best_ms", expand: "user",
    });
    return leaderboardRows(res.items, user()?.id || null);
  } catch { return []; }
}

function humanError(e) {
  const m = e?.response?.message || e?.message || "something went wrong";
  return /failed to authenticate|invalid/i.test(m) ? "email or password is incorrect" : m;
}
```

- [ ] **Step 5: Run pure-logic tests to verify PASS**

Run the Step 3 command.
Expected: `3 passed, 0 failed`, exit 0. (Node resolves cloud.js because the SDK import is deferred inside `init()`; the pure helpers `leaderboardRows`/`bestOf` need no network.)

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/cloud.js contraption-lab/js/cloud.test.js contraption-lab/index.html
git commit -m "contraption-lab: cloud.js — PB auth, progress sync, leaderboard read"
```

---

### Task 5: account UI panel (auth-ui.js) + styles

**Files:**
- Create: `contraption-lab/js/auth-ui.js`
- Modify: `contraption-lab/index.html` (account button in the bar + `<dialog id="accountDlg">` + an online/local dot)
- Modify: `contraption-lab/style.css` (panel + dot styles)

**Interfaces:**
- Consumes: `cloud`, `init`, `user`, `signup`, `login`, `logout` (cloud.js).
- Produces: `mountAccountUI({ onAuthChange })` → wires the account button + dialog; calls `onAuthChange()` after a successful login/signup/logout so main.js can pull/refresh. Also exposes `setIndicator(online)` to flip the dot.

- [ ] **Step 1: Add the account button, dialog, and indicator to index.html**

In `contraption-lab/index.html`, in the `<header class="bar">`, add an account button before the theme `<label>`:
```html
      <button id="accountBtn" class="ghostbtn" type="button">Sign in</button>
      <span id="netDot" class="netdot" title="local only">○</span>
```
And before the closing `</body>` (next to the other dialogs), add:
```html
  <dialog id="accountDlg" class="account">
    <form method="dialog">
      <h3 id="accountTitle">Account</h3>
      <p class="hint">Sign in to sync your progress across devices and join the leaderboards. The game works fully without an account.</p>
      <input id="acEmail" type="email" placeholder="email" autocomplete="email">
      <input id="acPass" type="password" placeholder="password" autocomplete="current-password">
      <input id="acName" type="text" placeholder="display name (for the leaderboard)" autocomplete="nickname">
      <p id="acError" class="acerror" hidden></p>
      <menu>
        <button id="acLogin" value="default" type="button">Sign in</button>
        <button id="acSignup" value="default" type="button">Create account</button>
        <button id="acLogout" value="default" type="button" hidden>Sign out</button>
        <button value="cancel">Close</button>
      </menu>
    </form>
  </dialog>
```

- [ ] **Step 2: Add styles to style.css**

Append to `contraption-lab/style.css`:
```css
.netdot{font-size:.9rem;opacity:.7;user-select:none}
.netdot.online{color:var(--goal);opacity:1}
dialog.account{min-width:min(92vw,340px)}
dialog.account input{display:block;width:100%;margin:8px 0;padding:10px;border-radius:8px;border:1px solid var(--part-stroke);background:var(--bg);color:var(--ink);font-family:var(--font)}
dialog.account .hint{opacity:.8;font-size:.85rem;line-height:1.4}
dialog.account .acerror{color:#e23;font-size:.85rem}
dialog.account menu{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:12px 0 0}
dialog.account menu button{font-family:var(--font);background:var(--fixed-fill);color:var(--ink);border:1px solid var(--part-stroke);border-radius:8px;padding:8px 12px;cursor:pointer}
```

- [ ] **Step 3: Implement auth-ui.js**

```js
// contraption-lab/js/auth-ui.js
import { cloud, user, signup, login, logout } from "./cloud.js";

export function setIndicator() {
  const dot = document.getElementById("netDot");
  const u = user();
  if (u) { dot.textContent = "●"; dot.className = "netdot online"; dot.title = "synced as " + (u.name || u.email); }
  else if (cloud.available) { dot.textContent = "○"; dot.className = "netdot"; dot.title = "online — not signed in"; }
  else { dot.textContent = "○"; dot.className = "netdot"; dot.title = "local only"; }
}

export function mountAccountUI({ onAuthChange }) {
  const dlg = document.getElementById("accountDlg");
  const btn = document.getElementById("accountBtn");
  const email = document.getElementById("acEmail");
  const pass = document.getElementById("acPass");
  const name = document.getElementById("acName");
  const err = document.getElementById("acError");
  const loginBtn = document.getElementById("acLogin");
  const signupBtn = document.getElementById("acSignup");
  const logoutBtn = document.getElementById("acLogout");

  function refresh() {
    const u = user();
    btn.textContent = u ? (u.name || u.email) : "Sign in";
    logoutBtn.hidden = !u;
    name.hidden = !!u; email.hidden = !!u; pass.hidden = !!u;
    loginBtn.hidden = !!u; signupBtn.hidden = !!u;
    document.getElementById("accountTitle").textContent = u ? ("Signed in as " + (u.name || u.email)) : "Account";
    setIndicator();
  }
  function showErr(m){ err.textContent = m; err.hidden = !m; }

  btn.onclick = () => { showErr(""); refresh(); dlg.showModal(); };
  loginBtn.onclick = async () => {
    showErr(""); const r = await login(email.value.trim(), pass.value);
    if (r.ok) { refresh(); dlg.close(); onAuthChange && onAuthChange(); } else showErr(r.error);
  };
  signupBtn.onclick = async () => {
    showErr(""); const r = await signup(email.value.trim(), pass.value, name.value.trim());
    if (r.ok) { refresh(); dlg.close(); onAuthChange && onAuthChange(); } else showErr(r.error);
  };
  logoutBtn.onclick = () => { logout(); refresh(); dlg.close(); onAuthChange && onAuthChange(); };

  refresh();
}
```

- [ ] **Step 4: Syntax-check both modules**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && node --check js/auth-ui.js && echo "auth-ui OK" && node --check js/cloud.js && echo "cloud OK"; cd ..
```
Expected: `auth-ui OK` then `cloud OK`.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/auth-ui.js contraption-lab/index.html contraption-lab/style.css
git commit -m "contraption-lab: account panel UI + online/local indicator"
```

---

### Task 6: wire cloud into main.js (boot, onWin push, ?test) + leaderboard overlay

**Files:**
- Modify: `contraption-lab/js/main.js`
- Modify: `contraption-lab/index.html` (leaderboard button + `<dialog id="lbDlg">`)
- Modify: `contraption-lab/js/level.test.js` (include cloudCases + progressShapeCases in the `?test` run)

**Interfaces:**
- Consumes: `init`, `cloud`, `user`, `pushProgress`, `pullProgress`, `leaderboard` (cloud.js); `mountAccountUI`, `setIndicator` (auth-ui.js); existing main.js state (`current`, `sim`, `onWin`).
- Produces: a booted cloud layer that (a) on load inits + pulls remote progress and refreshes the level menu's ✓ marks, (b) on win pushes the solve, (c) shows a per-level leaderboard overlay.

- [ ] **Step 1: Add the leaderboard button + dialog to index.html**

In the `.controls` div (next to Run/Reset), add:
```html
    <button id="lbBtn" type="button">🏆 Leaderboard</button>
```
And near the other dialogs before `</body>`:
```html
  <dialog id="lbDlg" class="account"><div id="lbBody"><h3>Leaderboard</h3><p class="hint">Sign in and solve a level to appear here.</p></div><form method="dialog"><menu><button value="cancel">Close</button></menu></form></dialog>
```

- [ ] **Step 2: Extend the ?test run in level.test.js**

Find the existing `?test` aggregation. The `?test` runner is invoked from main.js; update main.js's test block (Step 3) to also pull in `cloudCases` and `progressShapeCases`. In `level.test.js` no change is needed beyond Task 3/4's added exports — just confirm both `progressShapeCases` and (from cloud.test.js) `cloudCases` exist.

- [ ] **Step 3: Wire cloud into main.js**

At the TOP of `contraption-lab/js/main.js`, add imports after the existing ones:
```js
import { init as cloudInit, cloud, user as cloudUser, pushProgress, pullProgress, leaderboard } from "./cloud.js";
import { mountAccountUI, setIndicator } from "./auth-ui.js";
```

Replace the existing `?test` block with one that includes the new cases:
```js
if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(async m => {
    const cloudMod = await import("./cloud.test.js");
    m.runTests([ ...(await m.levelCases()), ...(await m.officialCases()), ...(await m.progressCases()),
                 ...(await m.progressShapeCases()), ...(await cloudMod.cloudCases()) ]);
  });
}
```

In `onWin()`, after the existing `recordSolve(...)` call, add a non-blocking cloud push of the freshly recorded progress:
```js
function onWin(){ const banner=document.getElementById("banner"); banner.textContent="Solved! ✓ "+sim.partsUsed()+" parts";
  banner.hidden=false; recordSolve(current.id, sim.partsUsed(), Math.round(sim.elapsed));
  document.getElementById("levelTitle").textContent = current.title + " ✓";
  import("./progress.js").then(p => pushProgress(p.getProgress())); }
```

At the BOOT section (where SW registers), add cloud bring-up + account UI + leaderboard wiring:
```js
// --- Phase 2: optional cloud (never blocks the game) ---
mountAccountUI({ onAuthChange: async () => { await pullProgress(); refreshMenuMarks(); setIndicator(); } });
cloudInit().then(async () => {
  setIndicator();
  if (cloudUser()) { await pullProgress(); refreshMenuMarks(); }
});
document.getElementById("lbBtn").onclick = async () => {
  const body = document.getElementById("lbBody");
  body.innerHTML = ""; // safe: we rebuild with textContent below
  const h = document.createElement("h3"); h.textContent = "Leaderboard — " + current.title; body.appendChild(h);
  if (!cloud.available) { const p=document.createElement("p"); p.className="hint"; p.textContent="Offline — leaderboards need a connection."; body.appendChild(p); }
  else {
    const rows = await leaderboard(current.id);
    if (!rows.length) { const p=document.createElement("p"); p.className="hint"; p.textContent="No solves yet. Be the first!"; body.appendChild(p); }
    else {
      const ol = document.createElement("ol");
      rows.forEach(r => { const li=document.createElement("li");
        li.textContent = `${r.name} — ${r.parts} part${r.parts===1?"":"s"}, ${(r.ms/1000).toFixed(1)}s`;
        if (r.isMe) li.style.fontWeight = "700"; ol.appendChild(li); });
      body.appendChild(ol);
    }
  }
  document.getElementById("lbDlg").showModal();
};
```

Add a small helper near `buildMenu` to re-mark solved levels (used after a pull). If `buildMenu` rebuilds the dialog each open, `refreshMenuMarks` just no-ops the menu but updates the current title:
```js
function refreshMenuMarks(){ document.getElementById("levelTitle").textContent = current ? (current.title + (isSolved(current.id) ? " ✓" : "")) : ""; }
```

- [ ] **Step 4: Syntax-check all modules**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && for f in js/*.js; do node --check "$f" && echo "$f ok" || exit 1; done; cd ..
```
Expected: every file prints `ok`.

- [ ] **Step 5: Run the full self-test suite headlessly (Matter stub)**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab
node --input-type=module -e "globalThis.Matter={Bodies:{circle:(x,y,r,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)}),rectangle:(x,y,w,h,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)})},Body:{create:(o)=>({...o,position:{x:0,y:0},vertices:[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}}),setAngle(){},setStatic(){},setVelocity(){},applyForce(){}},Constraint:{create:()=>({})},Composite:{add(){}},Engine:{create:()=>({world:{},gravity:{}}),update(){}},Query:{point:()=>[]}};import('./js/level.test.js').then(async m=>{const c=await import('./js/cloud.test.js');const r=m.runTests([...await m.levelCases(),...await m.officialCases(),...await m.progressCases(),...await m.progressShapeCases(),...await c.cloudCases()]);console.log(JSON.stringify(r));process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: a JSON line with `"failed":0` (count rises from 38 to 44: +3 progressShape, +3 cloud), exit 0.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/main.js contraption-lab/index.html contraption-lab/js/level.test.js
git commit -m "contraption-lab: wire cloud sync + leaderboard overlay into main"
```

---

### Task 7: cache the SDK in the service worker + bump cache

**Files:**
- Modify: `contraption-lab/sw.js`

**Interfaces:**
- Produces: an SW that adds the new JS modules to its SHELL and bumps the cache name, while STILL skipping cross-origin (so the PB API and the CDN SDK are never cached — the SDK loads from CDN on first online visit, then the app shell is offline-capable without it).

- [ ] **Step 1: Add new modules to SHELL and bump cache version**

In `contraption-lab/sw.js`:
- Change `const CACHE = "vibe-contraption-lab-v1";` → `"vibe-contraption-lab-v2";`
- Add to the SHELL array: `"./js/cloud.js","./js/auth-ui.js"`.
(Do NOT add the CDN `pocketbase` URL — it's cross-origin and the existing fetch handler correctly skips it.)

- [ ] **Step 2: Verify the SW still skips cross-origin and lists the new files**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
echo "cache bumped: $(grep -c 'vibe-contraption-lab-v2' contraption-lab/sw.js)"
echo "cloud.js in shell: $(grep -c './js/cloud.js' contraption-lab/sw.js)"
echo "auth-ui in shell: $(grep -c './js/auth-ui.js' contraption-lab/sw.js)"
echo "cross-origin guard intact: $(grep -c 'origin !== self.location.origin' contraption-lab/sw.js)"
```
Expected: all four print `1`.

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/sw.js
git commit -m "contraption-lab: SW caches cloud modules, bump to v2"
```

---

### Task 8: docs sync (README + CLAUDE.md) — Phase 2 note

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:** none (docs). No works-index change (the demo is already entry 12; Phase 2 adds capability, not a new demo).

- [ ] **Step 1: Update the contraption-lab bullet in README.md**

Append to the existing contraption-lab bullet in `README.md` (the sentence currently ending "tier-1 ready (PocketBase accounts + community level editor planned)."): replace that trailing clause with:
```
 **Optional accounts (PocketBase):** sign in to sync solved-level progress across devices and appear on per-level leaderboards (fewest parts, then fastest time) — fully playable signed-out (local-first). Community level editor still planned (Phase 3).
```

- [ ] **Step 2: Update the contraption-lab entry in CLAUDE.md's shipped list**

In `CLAUDE.md`, change the contraption-lab bullet's Phase wording from "Phase 1 of a phased build — Phase 2 (PocketBase accounts/progress, port 8100) and Phase 3 (community level editor) are designed but not built" to:
```
**Phases 1–2 shipped** — Phase 2 added optional PocketBase accounts (port 8100, `pb/pb_migrations/001_init_progress.js`, `progress` collection = synced progress + per-level leaderboard; local-first, signed-out works fully). Phase 3 (community level editor) still planned. Spec: `docs/superpowers/specs/2026-06-20-contraption-lab-design.md`.
```

- [ ] **Step 3: Verify both files mention the backend**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
echo "README: $(grep -c 'leaderboard' README.md)"; echo "CLAUDE: $(grep -c 'Phases 1.2 shipped\|progress collection' CLAUDE.md)"
```
Expected: README ≥ 1; CLAUDE ≥ 1.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add README.md CLAUDE.md
git commit -m "contraption-lab: docs — Phase 2 accounts/leaderboard note"
```

---

### Task 9: real-browser end-to-end verification (the quality gate)

**Files:** none (verification only; may create scratch test files OUTSIDE the repo in /tmp).

**Interfaces:** none. This proves the live, deployed Phase-2 behavior with a real headless browser, the same bar as Phase 1.

- [ ] **Step 1: Confirm the backend is live (from Task 2) and self-tests pass**

Run:
```bash
echo "health: $(curl -s -o /dev/null -w '%{http_code}' https://contraption-lab.pb.gurum.se/api/health)"
cd /home/ubuntu/projects/vibe-demos/contraption-lab
node --input-type=module -e "globalThis.Matter={Bodies:{circle:(x,y,r,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)}),rectangle:(x,y,w,h,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)})},Body:{create:(o)=>({...o,position:{x:0,y:0},vertices:[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}}),setAngle(){},setStatic(){},setVelocity(){},applyForce(){}},Constraint:{create:()=>({})},Composite:{add(){}},Engine:{create:()=>({world:{},gravity:{}}),update(){}},Query:{point:()=>[]}};import('./js/level.test.js').then(async m=>{const c=await import('./js/cloud.test.js');const r=m.runTests([...await m.levelCases(),...await m.officialCases(),...await m.progressCases(),...await m.progressShapeCases(),...await c.cloudCases()]);process.exit(r.failed?1:0)})" 2>&1 | tail -1; cd ..
```
Expected: `health: 200`; tests `44 passed, 0 failed`.

- [ ] **Step 2: Write a Playwright E2E that serves the local frontend (talking to the LIVE backend) and exercises the full account flow**

Create `/tmp/cl2-test/e2e.mjs` (reuse the Playwright install at `/tmp/pw/node_modules` from Phase 1; if absent, `npm i playwright` in /tmp/cl2-test). The test must, against `python3 -m http.server` serving `contraption-lab/`:
  1. Load the page; assert 0 pageerror and 0 console errors on boot.
  2. Wait for `cloud.available` (poll `window`-exposed state or check the `#netDot` title becomes "online — not signed in"). If the backend is unreachable from this box, SKIP the auth assertions but still assert the game is playable offline (place→run→win level 1) and report SKIPPED — do not fail the gate on network egress limits.
  3. If online: create a unique account (email like `e2e+<timestamp>@example.com` — pass the timestamp into the page via evaluate arg; do NOT use Date.now() inside a workflow but a plain Playwright script may), assert `#accountBtn` now shows the display name and `#netDot` is `online` class.
  4. Solve level 1 (select ramp, place at world (200,200), Run, await "Solved!"). Then open the Leaderboard dialog (`#lbBtn`) and assert the signed-in user's row appears (text contains the display name).
  5. Reload the page; assert the account persisted (still signed in via authStore) and the level still shows ✓.
  6. Sign out; assert `#accountBtn` returns to "Sign in" and the game still plays.
  Save a screenshot to /tmp/cl2-test/e2e.png.

- [ ] **Step 3: Run the E2E and confirm**

Run:
```bash
cd /tmp/cl2-test && node e2e.mjs 2>&1 | grep -v "delta argument"
```
Expected: boot 0 errors; either the full signed-in flow passes (account shows, leaderboard row present, persists across reload, sign-out works) OR a clear `SKIPPED: backend unreachable from CI` with the offline playability still asserted. NO uncaught page/console errors in any path.

- [ ] **Step 4: Manual-equivalent live check (frontend deploy happens at merge; here verify local build is sound)**

Run a final asset + importmap sanity check:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && python3 -m http.server 8211 >/dev/null 2>&1 & sleep 1
echo "importmap present: $(curl -s http://localhost:8211/ | grep -c 'pocketbase@0.26.2')"
echo "account btn: $(curl -s http://localhost:8211/ | grep -c 'id=\"accountBtn\"')"
echo "lb btn: $(curl -s http://localhost:8211/ | grep -c 'id=\"lbBtn\"')"
kill %1 2>/dev/null; cd ..
```
Expected: all three print `1`.

- [ ] **Step 5: Record the verification result**

No commit needed (verification only). The implementer reports: backend health code, test count, E2E outcome (PASS or SKIPPED-with-reason), and the screenshot path, in the task report.

---

## After all tasks

The branch is ready to merge to `main` (which deploys the frontend via Pages; the backend is already live from Task 2). Finishing handled by the controller via finishing-a-development-branch.

---

## Self-Review

**Spec coverage (spec §4 Phase 2):**
- "PocketBase email/password auth; anonymous play always works" → Task 4 signup/login/logout; local-first guaranteed by Global Constraints + Task 6 boot-never-blocks. ✓
- "`progress` collection `{user, level_id, solved, best_parts, best_ms}`; local-first; merge best-of on load" → Task 1 (collection), Task 3 (`applyRemote` via `mergeProgress`), Task 4 (`pullProgress`/`pushProgress`). ✓
- "Per-level leaderboard: fewest parts, then fastest time" → Task 4 `leaderboard()` (sort `best_parts,best_ms`), Task 6 overlay. ✓
- Conventions (singular snake_case, port 8100, exact SDK pin, migrations source of truth, SW skips cross-origin, subtle online/offline indicator, Context7-checked syntax) → Tasks 1,2,4,5,7 + Global Constraints. ✓

**Placeholder scan:** No TBD/TODO. The migration, SDK code, UI, and tests are all written out in full. The only deferred-to-runtime item is the live deploy in Task 2 and E2E in Task 9, both with concrete commands and explicit expected output. The E2E (Task 9 Step 2) is described as steps rather than full code because it depends on whether this box has network egress to the live PB host — but it names every assertion, the file path, the skip condition, and the screenshot output, and reuses the Phase-1 Playwright harness pattern. Not a placeholder: it's a conditional verification with a defined fallback.

**Type consistency:** `progress` field names (`user, level_id, solved, best_parts, best_ms`) are identical across the migration (Task 1), `progressToRecords`/`recordsToProgress`/`bestOf` (Tasks 3–4), and the leaderboard sort/filter (Task 4). `cloud` API (`init, available, user, signup, login, logout, pushProgress, pullProgress, leaderboard, leaderboardRows, bestOf`) is consistent between cloud.js (Task 4), auth-ui.js (Task 5), and main.js (Task 6). `mergeProgress`/`getProgress`/`KEY` reused from Phase-1 progress.js, not redefined (Task 3 note). Test exports `progressShapeCases` (level.test.js) and `cloudCases` (cloud.test.js) are referenced consistently in the `?test` block and the headless command (Tasks 3,4,6,9).

**Known risk flagged for executor:** Task 2 (deploy) and Task 9 (E2E auth) require network egress from this box to `pb-backends`/the live host. `ssh pb-backends` was confirmed reachable on 2026-06-20, but if `sync-backends.sh` or the HTTPS health check fails due to environment network limits, the executor must surface that as BLOCKED (not silently skip) — the backend MUST be live for Phase 2 to be "complete." The frontend E2E has an explicit offline-skip path, but the deploy itself does not.
