# clinic-admin Shared Multi-Tenant Workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `clinic-admin/` from a stateless, single-device admin toolkit into a **shared, authenticated, multi-tenant clinic workspace**. A real login front door (email/password + Google OAuth + 회원가입) with a one-tap 데모 클리닉 shortcut gates clinic-scoped shared data; the genuinely-collective admin workflows (면허 명부, 인증 체크리스트, KCD 코드표, 비급여 dataset, 자보 삭감 추세, 접수 현황판) become hosted, jointly-edited, and exportable, while per-person/PII tools stay local-first.

**Architecture:** PocketBase backend at `https://clinic-admin.pb.gurum.se`. Tenancy: **CLINIC = tenant**. An auth-type `users` collection (extending the built-in) carries `name`, `clinic` (relation), `role` (select 원장|직원). A `clinic` base collection holds `name` + unique `join_code`. Each domain collection carries a `clinic` relation + autodate and is access-controlled by **PocketBase collection API rules** (`clinic = @request.auth.clinic`), with role-gated writes (`@request.auth.role = '원장'`) on the reference tables. The frontend stays plain static HTML/JS (no build tool); the PB SDK is imported as ESM. The existing isolated `<script type="module">` realtime board is **extended, not rebuilt**, and a new auth/session module sits beside it. Local-first is preserved: the page loads and all local tools work with the backend down; shared/auth features degrade calmly to a "오프라인 — 이 기기에서만" state.

**Tech Stack:** Static HTML/CSS/JS. PocketBase `@0.25.0` (CDN ESM, dynamic `import()`). `xlsx@0.18.5` is **already loaded** in the page head (line 23) — use it for `.xlsx` export where useful; default to `.csv` (zero-dep) per the no-build-tool rule. Verification: `node --check` on extracted module bodies + headless Playwright smoke against the real backend (no unit-test framework).

---

## Important constraints (bake into every phase)

- **No build tool / framework / package.json.** Edit `clinic-admin/index.html`, `clinic-admin/sw.js`, and `clinic-admin/pb/pb_migrations/*.js` in place. PB SDK via CDN ESM only.
- **PB SDK import style — match the existing board.** The page deliberately does **dynamic `import(PB_ESM)`** by full URL (line 7025), NOT a static `import … from "pocketbase"` + importmap. A static bare import throws at module-eval time and kills every handler; the dynamic import degrades gracefully when the CDN/backend is down. **Reuse the existing `getPB()` singleton — do not create a second SDK instance.** One `pb` instance is shared between auth and the realtime board so the auth token attaches to board requests automatically.
- **Migrations are the source of truth.** New migrations are `003+`, sequential, never renumbered. Every base collection declares `created`/`updated` as **autodate** fields (the `002_add_autodate.js` bug — do not omit on any new base collection). Deploy with `./sync-backends.sh` from the repo root.
- **XSS-safe:** `textContent` only for any user/clinic-submitted field (names, summaries, license numbers, code labels). **Never `innerHTML` with PB field values.** (Static template scaffolding via innerHTML is fine; injecting record data is not.)
- **No reconnection polling.** Use `subscribe()` + SDK auto-reconnect + event-driven re-subscribe (on `visibilitychange` / re-login), guarded by a sentinel + an `_subAborted` teardown flag — mirror the pattern live-globe just shipped (sentinel-guarded `subscribeLive` + visibility re-subscribe + `_subAborted` teardown). Health-check only on user-initiated actions.
- **Local-first:** page must load and local tools must work with the backend down. Shared/auth features require login + connectivity by nature — degrade to the existing `○ local` / "오프라인" state, never block the page or throw uncaught.
- **PB `created` date gotcha:** PB returns `created` space-separated (`"2026-06-06 10:13:34.219Z"`). Any date parsing MUST use `Date.parse(s.replace(" ", "T"))` (Safari/iPhone returns `NaN` otherwise — verified).
- **Korean UI copy + editorial/celadon aesthetic.** All new UI strings in Korean, matching the existing voice (formal-polite, 행정원장 audience). Reuse existing CSS classes/vars (`--accent` rust, `--paper` cream, `--ink`, `.btn`, `.btn.secondary`, `.panel`, `.card`, `.welcome-scrim`, `.result-toolbar`) — do not invent a new visual system. New auth screen reuses the `.welcome-scrim` / `.welcome` shell grammar.
- **Bump SW cache** `vibe-clinic-admin-v15` → `v16` on first ship; the existing SW already skips cross-origin (PB) fetches (line ~30) — leave that intact.

---

## Scope & Phasing note (be honest: this is large)

This is **materially larger than any prior clinic-admin change** — it introduces authentication, multi-tenancy, role-based server rules, and converts five workflows from local to hosted-shared. It is too big for one linear run. It decomposes into **5 phases, each of which ships independently and should be its own subagent-driven run** (own branch/worktree, own verification, own deploy of any new migration). Phase 1 is the **critical path** — every later phase depends on a logged-in user with a resolved `clinic` and `role`. Do Phase 1 fully and correctly before starting any other.

1. **Phase 1 — Auth foundation (critical path).** `users` (auth) + `clinic` collections, login screen, demo shortcut, JOIN/CREATE onboarding fork, session wiring, single shared `pb` instance. **Full code.**
2. **Phase 2 — Realtime 접수 현황판 (00).** Completes the existing `subscribe()` stub, scopes `intake_card` by clinic, relabels player→station in UI, hardens the subscribe lifecycle. Smallest shared win; proves the clinic-scoped + realtime pattern. **Full code.**
3. **Phase 3 — 면허 명부 (08) + 인증 체크리스트 (09).** The two strongest shared workflows. **Task-granular + representative code** (they reuse the Phase 2 clinic-scoped collection pattern + a shared import/export helper introduced here).
4. **Phase 4 — Hosted reference data (01 KCD, 04 비급여).** Role-gated (원장-write) reference tables with import-once / joint-edit / anyone-exports. **Task-granular + representative code.**
5. **Phase 5 — 자보 삭감 ledger (02).** Aggregate-only shared ledger (no patient detail). **Task-granular + representative code.**

**Why full code stops after Phase 2:** Phases 3–5 are all the *same shape* — a clinic-scoped collection, a migration declaring `clinic` + autodate + (sometimes) a role-gated rule, a render that swaps `Store.get(...)` for a clinic-scoped `getFullList()` with local fallback, plus the shared `⬆가져오기 / ⬇내보내기` + presence-line helper built once in Phase 3. Once Phases 1–2 establish the auth wiring, the realtime lifecycle, and the migration idiom with complete code, an engineer has every concrete pattern needed; Phases 3–5 give exact files, exact migration bodies, exact collection fields, and one representative render/import/export per phase rather than re-pasting near-identical code. **No phase is left as a placeholder — every collection's fields, rules, and the wiring strategy are fully specified.**

---

## File Structure

```
clinic-admin/
├── index.html                       ← edit in place (auth module, board extension, shared-tab wiring)
├── sw.js                            ← bump cache v15 → v16
└── pb/pb_migrations/
    ├── 001_init_intake_card.js      ← exists (do not edit)
    ├── 002_add_autodate.js          ← exists (do not edit)
    ├── 003_clinic_and_users.js      ← NEW (Phase 1) — clinic base + users auth fields + seed demo clinic/user
    ├── 004_intake_card_clinic.js    ← NEW (Phase 2) — add clinic relation to intake_card, tighten rules
    ├── 005_license_accred.js        ← NEW (Phase 3) — license + accred_item collections
    ├── 006_reference_tables.js      ← NEW (Phase 4) — kcd_code + bigeup_item (role-gated)
    └── 007_jabo_ledger.js           ← NEW (Phase 5) — jabo_deduction
backends/config.json                 ← no change (clinic-admin already registered, port 8093)
docs/superpowers/plans/2026-06-06-clinic-admin-shared-workspace.md  ← this file
```

**Temp (untracked, deleted at phase end):** `clinic-admin/_smoke*.mjs`.

---

# PHASE 1 — Auth foundation (critical path) · FULL CODE

**Outcome:** A logged-in user has `pb.authStore.isValid === true`, `pb.authStore.model.clinic` (a clinic id), and `pb.authStore.model.role` (`원장`|`직원`). A first-time visitor sees a login screen with email/pw, Google, 회원가입 (JOIN default / CREATE secondary), and a 🩺 데모 클리닉 one-tap card. The page still loads with the backend down (local tools work; shared features show offline).

### Key auth decisions made in this plan (resolving spec ambiguity)

- **`users` is created as a brand-new auth collection in migration `003`** (not "extend the system `_pb_users_auth_`"). PocketBase 0.25 ships a default `users` auth collection; rather than depend on its exact id, the migration looks it up by name and, if absent, creates an auth collection named `users`, then adds the custom fields (`name`, `clinic`, `role`). This is idempotent and survives a fresh server. *(Human confirm: see §self-review note 1.)*
- **Demo seed is provisioned by the migration**, not a manual admin step: `003` creates a `clinic` row `데모 클리닉` with a fixed `join_code` (`DEMO-0000`) and a `users` row (`demo@clinic-admin.demo` / a fixed password constant baked into both the migration and the frontend). The frontend's demo button does a normal `authWithPassword(DEMO_EMAIL, DEMO_PW)`. This keeps rules uniform (the demo account is just a normal authed member of a shared clinic — the spec's preferred option, §10).
- **Google OAuth provider config is an out-of-band PB admin step** (Settings → Auth providers → Google: client id/secret + redirect). The migration cannot set OAuth secrets. The plan notes this as a deploy/config task; the frontend code is written and works the moment the provider is enabled, and the button shows a calm "구글 로그인 준비 중" state if `listAuthMethods()` reports Google disabled.
- **`intake_card.player_id` stays the column name; UI relabels to 스테이션** (spec §10 lean choice). A future `008` migration may rename — out of scope here.

---

## Task 1.1 — Migration `003_clinic_and_users.js` (clinic + users-auth + demo seed)

**Files:** `clinic-admin/pb/pb_migrations/003_clinic_and_users.js` (new)

- [ ] 1. Create the file with this exact body:

```js
// clinic-admin/pb/pb_migrations/003_clinic_and_users.js
//
// Multi-tenant foundation for the shared clinic-admin workspace.
//   - clinic (base): the tenant. name + unique join_code + autodate.
//   - users  (auth): extend the default users auth collection with
//     name (text), clinic (relation→clinic), role (select 원장|직원).
//   - Seed a real shared "데모 클리닉" + a demo member account so the
//     login screen's one-tap demo shortcut is a normal authWithPassword
//     into a normal authed account (uniform rules — spec §3.3 / §10).
//
// Migrations are the source of truth (CLAUDE.md). Idempotent: looks
// collections up by name and only creates what is missing.
migrate((app) => {
  // ── clinic (tenant) ──────────────────────────────────────────
  let clinic;
  try { clinic = app.findCollectionByNameOrId("clinic"); } catch (e) { clinic = null; }
  if (!clinic) {
    clinic = new Collection({
      type: "base",
      name: "clinic",
      // Any authed user may read clinics (needed for join-code lookup at
      // signup, before they belong to one). Create is open so "새 클리닉
      // 만들기" works for a self-signed-up 원장. Update/delete locked.
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "text", name: "name", required: true, max: 60 },
        { type: "text", name: "join_code", required: true, max: 24 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_clinic_join_code ON clinic (join_code)",
      ],
    });
    app.save(clinic);
  }

  // ── users (auth) — extend the default auth collection ─────────
  let users;
  try { users = app.findCollectionByNameOrId("users"); } catch (e) { users = null; }
  if (!users) {
    users = new Collection({ type: "auth", name: "users" });
    app.save(users);
    users = app.findCollectionByNameOrId("users");
  }
  // Add custom fields if missing (idempotent).
  const has = (n) => users.fields.find((f) => f.name === n);
  if (!has("name")) {
    users.fields.add(new Field({ type: "text", name: "name", max: 60 }));
  }
  if (!has("clinic")) {
    users.fields.add(new Field({
      type: "relation", name: "clinic",
      required: false, maxSelect: 1, collectionId: clinic.id,
      cascadeDelete: false,
    }));
  }
  if (!has("role")) {
    users.fields.add(new Field({
      type: "select", name: "role", maxSelect: 1,
      values: ["원장", "직원"],
    }));
  }
  // A user may read/update only their own record; clinic members read each
  // other indirectly via clinic-scoped domain collections, not via users.
  users.listRule   = "id = @request.auth.id";
  users.viewRule   = "id = @request.auth.id";
  users.updateRule = "id = @request.auth.id";
  users.createRule = "";          // open signup (JOIN / CREATE flows)
  users.deleteRule = null;
  app.save(users);

  // ── Seed demo clinic + demo member ───────────────────────────
  let demoClinic;
  try { demoClinic = app.findFirstRecordByData("clinic", "join_code", "DEMO-0000"); }
  catch (e) { demoClinic = null; }
  if (!demoClinic) {
    demoClinic = new Record(clinic);
    demoClinic.set("name", "데모 클리닉");
    demoClinic.set("join_code", "DEMO-0000");
    app.save(demoClinic);
  }
  let demoUser;
  try { demoUser = app.findAuthRecordByEmail("users", "demo@clinic-admin.demo"); }
  catch (e) { demoUser = null; }
  if (!demoUser) {
    demoUser = new Record(users);
    demoUser.set("email", "demo@clinic-admin.demo");
    demoUser.set("emailVisibility", false);
    demoUser.set("verified", true);
    demoUser.setPassword("demo-clinic-2026");   // matches DEMO_PW in the frontend
    demoUser.set("name", "데모 사용자");
    demoUser.set("clinic", demoClinic.id);
    demoUser.set("role", "원장");                // demo can exercise role-gated writes
    app.save(demoUser);
  }
}, (app) => {
  // Down: remove custom fields + seeds; do NOT delete the default users
  // collection itself (built-in). Drop the clinic collection we created.
  try {
    const users = app.findCollectionByNameOrId("users");
    ["role", "clinic", "name"].forEach((n) => { try { users.fields.removeByName(n); } catch (e) {} });
    app.save(users);
  } catch (e) {}
  try {
    const demoUser = app.findAuthRecordByEmail("users", "demo@clinic-admin.demo");
    if (demoUser) app.delete(demoUser);
  } catch (e) {}
  try {
    const clinic = app.findCollectionByNameOrId("clinic");
    app.delete(clinic);   // cascades its records
  } catch (e) {}
});
```

- [ ] 2. `node --check` the migration:
```bash
node --check /home/ubuntu/projects/vibe-demos/clinic-admin/pb/pb_migrations/003_clinic_and_users.js && echo OK
```
Expected: `OK`. (PB migration globals `migrate`/`Collection`/`Field`/`Record` are injected by the PB runtime; `node --check` validates syntax only, which is what we want.)

- [ ] 3. Deploy + verify the collection landed:
```bash
cd /home/ubuntu/projects/vibe-demos && ./sync-backends.sh 2>&1 | tail -20
ssh pb-backends "cd /opt/pocketbase/clinic-admin && ./pocketbase migrate up 2>&1 | tail -5" || true
curl -s "https://clinic-admin.pb.gurum.se/api/health" | head -c 200; echo
```
Expected: health JSON `{"code":200,...}`. (If `migrate up` is auto-run by the systemd unit on deploy, the manual ssh line is a no-op confirmation.)

**Note for the implementer:** `findAuthRecordByEmail`, `findFirstRecordByData`, `Record`, `setPassword` are PocketBase 0.25 JSVM APIs. If any name differs on the deployed PB build, confirm against `ssh pb-backends "/opt/pocketbase/clinic-admin/pocketbase --help"` / the JSVM docs at `https://pocketbase.io/jsvm/` **before** editing — this is the one place the plan touches PB-version-specific seed APIs. (See §self-review note 1.)

---

## Task 1.2 — Auth/session module (the single shared `pb` + authStore wiring)

**Files:** `clinic-admin/index.html` — extend the existing realtime board `<script type="module">` (starts line 6984). The auth module shares its `getPB()` singleton; do not add a second SDK instance or a second module.

- [ ] 1. At the top of the existing module (just after the `const PB_URL`/`PB_ESM`/`getPB` block, ~line 7030), add the auth constants + session helpers:

```js
    // ── AUTH / SESSION (shared multi-tenant layer) ─────────────────
    // Reuses the single `pb` instance from getPB(). The SDK auto-persists
    // the auth token in localStorage and attaches it to every request, so
    // the realtime board and all shared tabs are clinic-scoped once a user
    // is logged in. Local-first is preserved: with the backend down, getPB()
    // resolves null and the page runs on local stores.
    const DEMO_EMAIL = "demo@clinic-admin.demo";
    const DEMO_PW    = "demo-clinic-2026";   // matches the seed in migration 003

    const Session = {
      get user()    { return pb && pb.authStore.isValid ? pb.authStore.model : null; },
      get clinic()  { const u = this.user; return u ? u.clinic : null; },
      get role()    { const u = this.user; return u ? u.role : null; },
      isOwner()     { return this.role === "원장"; },
      isDemo()      { const u = this.user; return !!u && u.email === DEMO_EMAIL; },
      get valid()   { return !!(pb && pb.authStore.isValid && this.clinic); },
    };

    // Date gotcha: PB `created` is space-separated; Safari NaN without the swap.
    function pbDate(s) { return s ? Date.parse(String(s).replace(" ", "T")) : NaN; }

    // Fired whenever auth state changes (login / logout / token refresh) so
    // the board + every shared tab can re-fetch and re-subscribe.
    const authListeners = new Set();
    function onAuthChange(fn) { authListeners.add(fn); return () => authListeners.delete(fn); }
    function emitAuthChange() { for (const fn of authListeners) { try { fn(Session); } catch (e) { console.error(e); } } }
```

- [ ] 2. After `getPB()` resolves a `pb` instance the first time, register the SDK's authStore change hook so token refresh / OAuth callbacks fan out. Modify `getPB()`'s `.then`:

```js
    function getPB() {
      if (pb) return Promise.resolve(pb);
      if (!_pbPromise) {
        _pbPromise = import(PB_ESM)
          .then((m) => {
            pb = new m.default(PB_URL);
            // Fan out auth changes to the board + shared tabs.
            pb.authStore.onChange(() => emitAuthChange(), false);
            return pb;
          })
          .catch(() => { _pbPromise = null; return null; });
      }
      return _pbPromise;
    }
```

- [ ] 3. Add the auth action functions (login / signup-join / signup-create / demo / logout). Place after the `Session` block:

```js
    // join_code resolver: find an existing clinic by its share code.
    async function resolveClinicByCode(code) {
      const c = await getPB(); if (!c) throw new Error("offline");
      const norm = (code || "").trim().toUpperCase();
      if (!norm) throw new Error("코드를 입력하세요");
      // listRule allows any authed user to read clinics, but at signup the
      // user is not yet authed — so resolve via a throwaway: PB list with a
      // filter requires auth, so the JOIN flow creates the user FIRST with no
      // clinic, then patches clinic after resolving. See joinClinic().
      return norm;
    }

    async function login(email, pw) {
      const c = await getPB(); if (!c) throw new Error("offline");
      await c.collection("users").authWithPassword(email, pw);
      // model.expand is not auto; clinic is stored as id string — fine for rules.
      emitAuthChange();
    }

    async function loginGoogle() {
      const c = await getPB(); if (!c) throw new Error("offline");
      // Requires Google provider enabled in PB admin (out-of-band config).
      await c.collection("users").authWithOAuth2({ provider: "google" });
      // OAuth-created users have no clinic/role yet → caller routes them to
      // the onboarding fork if Session.clinic is null.
      emitAuthChange();
    }

    async function loginDemo() {
      const c = await getPB(); if (!c) throw new Error("offline");
      await c.collection("users").authWithPassword(DEMO_EMAIL, DEMO_PW);
      emitAuthChange();
    }

    // CREATE fork: new clinic → user is first member, role 원장.
    async function signupCreate({ name, email, pw, clinicName }) {
      const c = await getPB(); if (!c) throw new Error("offline");
      const code = makeJoinCode(clinicName);
      const clinic = await c.collection("clinic").create({ name: clinicName, join_code: code })
        // createRule requires auth; so authenticate as a fresh user first is
        // chicken-and-egg. Resolve: create the user (no clinic), auth, create
        // clinic, then patch the user's clinic+role. See ordering below.
        .catch((e) => { throw e; });
      return clinic; // (real ordering implemented in step 4 — see note)
    }
```

> **Implementer note (ordering — important):** `clinic.createRule` and `users` patching both require an authenticated session, but signup has no session yet. The correct, rule-respecting order is:
> 1. `users.create({ email, password, passwordConfirm, name })` (open `createRule`).
> 2. `authWithPassword(email, pw)` → now authed.
> 3. **JOIN:** `getFirstListItem("clinic", \`join_code="\${CODE}"\`)` → patch `users.update(model.id, { clinic: clinicId, role: "직원" })`.
> 4. **CREATE:** `clinic.create({ name, join_code })` (now authed) → patch `users.update(model.id, { clinic: newClinicId, role: "원장" })`.
> 5. `pb.authStore.model` is stale after the patch — call `c.collection("users").authRefresh()` then `emitAuthChange()` so `Session.clinic`/`Session.role` are populated.
> Write the two flows as `signupJoin({name,email,pw,code})` and `signupCreate({name,email,pw,clinicName})` following exactly that order. `makeJoinCode(clinicName)` = a short uppercase slug + 4 random digits, e.g. `SEORAK-4821` (dedupe-on-collision by retrying create on a unique-index 400).

- [ ] 4. Implement `signupJoin` / `signupCreate` per the ordering note, and `logout`:

```js
    function makeJoinCode(name) {
      const base = (name || "CLINIC").replace(/[^A-Za-z가-힣]/g, "").slice(0, 6).toUpperCase() || "CLINIC";
      const ascii = /[A-Za-z]/.test(base) ? base : "CLINIC";
      return ascii + "-" + String(Math.floor(1000 + Math.random() * 9000));
    }

    async function signupJoin({ name, email, pw, code }) {
      const c = await getPB(); if (!c) throw new Error("offline");
      await c.collection("users").create({ name, email, password: pw, passwordConfirm: pw });
      await c.collection("users").authWithPassword(email, pw);
      const norm = (code || "").trim().toUpperCase();
      let clinic;
      try { clinic = await c.collection("clinic").getFirstListItem(`join_code="${norm}"`); }
      catch (e) { throw new Error("참여 코드를 찾을 수 없습니다"); }
      await c.collection("users").update(c.authStore.model.id, { clinic: clinic.id, role: "직원" });
      await c.collection("users").authRefresh();
      emitAuthChange();
    }

    async function signupCreate({ name, email, pw, clinicName }) {
      const c = await getPB(); if (!c) throw new Error("offline");
      await c.collection("users").create({ name, email, password: pw, passwordConfirm: pw });
      await c.collection("users").authWithPassword(email, pw);
      let clinic, attempts = 0;
      while (attempts++ < 4) {
        try { clinic = await c.collection("clinic").create({ name: clinicName, join_code: makeJoinCode(clinicName) }); break; }
        catch (e) { if (attempts >= 4) throw e; }   // retry join_code collision
      }
      await c.collection("users").update(c.authStore.model.id, { clinic: clinic.id, role: "원장" });
      await c.collection("users").authRefresh();
      emitAuthChange();
      return clinic.join_code;   // surface so 원장 can share it
    }

    function logout() {
      if (pb) pb.authStore.clear();
      emitAuthChange();
    }
```

- [ ] 5. `node --check` the module (strip the bare-specifier static import issue — there isn't one here since we use dynamic `import(PB_ESM)`, so the module body checks clean). Extract + check:
```bash
cd /home/ubuntu/projects/vibe-demos/clinic-admin
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/g);fs.writeFileSync('_smoke_extract.mjs',m[m.length-1].replace(/<\/?script[^>]*>/g,''));"
node --check _smoke_extract.mjs && echo OK
rm -f _smoke_extract.mjs
```
Expected: `OK`. (Dynamic `import()` of a URL needs no resolution at parse time — node --check passes. If a `import ... from "pocketbase"` static line is ever added, this is where it would fail; the strip command would be `sed 's#from "pocketbase"#from "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs"#'` before `node --check`. We do not add one.)

---

## Task 1.3 — Login screen + onboarding fork (HTML/CSS)

**Files:** `clinic-admin/index.html` — add an auth scrim modeled on the existing `.welcome-scrim`/`.welcome` shell (the welcome markup is at line 2648; reuse its classes and the `--accent`/`--paper`/`--ink` tokens).

- [ ] 1. Add the auth scrim markup immediately **before** the existing `<div class="welcome-scrim" id="welcome-scrim" ...>` (line 2648). It has three views toggled by a class on the inner container (`data-view="login|join|create"`), default `login`:

```html
  <!-- ── Auth front door (login / 회원가입 fork / demo shortcut) ── -->
  <div class="welcome-scrim" id="auth-scrim" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <div class="welcome auth" id="auth-card" data-view="login">
      <div class="eyebrow">우리 병원 공용 행정 워크스페이스</div>
      <h2 id="auth-title">로그인하면 <em>팀 전체</em>가 같은 데이터를 봅니다</h2>
      <p class="deck">
        면허 명부·인증 체크리스트·코드표를 <strong>한 번 올리면</strong> 같은 병원 직원이 함께 쓰고, 누구나 최신 상태로 내려받습니다. <strong>환자 식별정보는 여전히 이 기기 안에서만</strong> 처리되고, 서버에는 집계·결과만 올라갑니다.
      </p>

      <!-- LOGIN view -->
      <div class="auth-view auth-login">
        <label class="auth-field"><span>이메일</span>
          <input type="email" id="auth-email" autocomplete="email" placeholder="you@clinic.kr"></label>
        <label class="auth-field"><span>비밀번호</span>
          <input type="password" id="auth-pw" autocomplete="current-password"></label>
        <p class="auth-err" id="auth-err" role="alert"></p>
        <div class="actions">
          <button type="button" class="btn" id="auth-login-btn">로그인</button>
          <button type="button" class="btn secondary" id="auth-google-btn">Google로 계속</button>
        </div>
        <p class="auth-switch">계정이 없으신가요? <button type="button" class="link-btn" id="auth-to-join">회원가입</button></p>
      </div>

      <!-- JOIN / CREATE fork (회원가입) -->
      <div class="auth-view auth-join" hidden>
        <div class="fork-tabs" role="tablist">
          <button type="button" class="fork-tab active" id="fork-join" role="tab">우리 병원에 합류</button>
          <button type="button" class="fork-tab" id="fork-create" role="tab">새 클리닉 만들기 <span class="muted-note">원장·관리자용</span></button>
        </div>
        <div class="fork-body fork-join-body">
          <label class="auth-field"><span>이름</span><input type="text" id="join-name" placeholder="홍길동"></label>
          <label class="auth-field"><span>이메일</span><input type="email" id="join-email" autocomplete="email"></label>
          <label class="auth-field"><span>비밀번호</span><input type="password" id="join-pw" autocomplete="new-password"></label>
          <label class="auth-field"><span>참여 코드</span><input type="text" id="join-code" placeholder="예: SEORAK-4821" autocomplete="off"></label>
          <p class="auth-err" id="join-err" role="alert"></p>
          <button type="button" class="btn" id="join-submit">합류하기 (직원)</button>
        </div>
        <div class="fork-body fork-create-body" hidden>
          <label class="auth-field"><span>이름</span><input type="text" id="create-name" placeholder="홍길동"></label>
          <label class="auth-field"><span>이메일</span><input type="email" id="create-email" autocomplete="email"></label>
          <label class="auth-field"><span>비밀번호</span><input type="password" id="create-pw" autocomplete="new-password"></label>
          <label class="auth-field"><span>병원 이름</span><input type="text" id="create-clinic" placeholder="서락한방병원"></label>
          <p class="auth-err" id="create-err" role="alert"></p>
          <button type="button" class="btn" id="create-submit">새 클리닉 만들기 (원장)</button>
        </div>
        <p class="auth-switch"><button type="button" class="link-btn" id="auth-to-login">← 로그인으로</button></p>
      </div>

      <!-- DEMO shortcut — always visible footer card -->
      <div class="demo-card" id="auth-demo-card">
        <div class="demo-card-text"><strong>🩺 데모 클리닉으로 둘러보기</strong><br><span class="muted-note">가입 없이 바로 · 공용 예시 데이터</span></div>
        <button type="button" class="btn secondary" id="auth-demo-btn">둘러보기</button>
      </div>
    </div>
  </div>
```

- [ ] 2. Add CSS in the existing `<style>` block near the `.welcome` rules (~line 2024+). Reuse tokens; do not introduce a new palette:

```css
    .welcome.auth { max-width: 460px; }
    .welcome.auth[data-view="login"] .auth-join,
    .welcome.auth[data-view="join"]  .auth-login,
    .welcome.auth[data-view="create"] .auth-login { display: none; }
    .welcome.auth[data-view="login"] .auth-login { display: block; }
    .welcome.auth[data-view="join"]  .auth-join,
    .welcome.auth[data-view="create"] .auth-join { display: block; }
    .auth-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 12px; color: var(--ink-2); }
    .auth-field input {
      font: inherit; font-size: 14px; padding: 9px 11px; border: 1px solid var(--line);
      border-radius: 8px; background: rgba(255,255,255,0.6); color: var(--ink);
    }
    .auth-field input:focus { outline: none; border-color: var(--accent); }
    .auth-err { color: var(--accent); font-size: 12px; min-height: 16px; margin: 2px 0 8px; }
    .auth-switch { font-size: 12px; color: var(--muted); margin-top: 12px; text-align: center; }
    .link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font: inherit; text-decoration: underline; }
    .fork-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .fork-tab { flex: 1; padding: 9px 8px; border: 1px solid var(--line); border-radius: 8px;
      background: rgba(255,255,255,0.4); cursor: pointer; font-size: 12.5px; color: var(--ink-2); }
    .fork-tab.active { border-color: var(--accent); color: var(--ink); background: rgba(255,255,255,0.8); }
    .muted-note { color: var(--muted); font-size: 10.5px; }
    .demo-card { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      margin-top: 20px; padding: 14px 16px; border: 1px dashed var(--line); border-radius: 10px;
      background: rgba(255,255,255,0.35); }
    .demo-card-text { font-size: 13px; line-height: 1.5; }
```

- [ ] 3. Verify the markup parses (HTML well-formedness via a quick Playwright load in Task 1.5; no separate check here).

---

## Task 1.4 — Wire the login screen + session-aware shell

**Files:** `clinic-admin/index.html` — the auth module (same `<script type="module">`).

- [ ] 1. Add view-toggle + button wiring inside the module, in a `wireAuthUI()` function called from `boot()`:

```js
    const authCard = () => $id("auth-card");
    const authScrim = () => $id("auth-scrim");
    function setAuthView(v) { const c = authCard(); if (c) c.dataset.view = v; }
    function showAuth() { const s = authScrim(); if (s) s.classList.add("open"); }
    function hideAuth() { const s = authScrim(); if (s) s.classList.remove("open"); }
    function setForkBody(which) {
      const c = authCard(); if (!c) return;
      c.querySelector(".fork-join-body").hidden   = which !== "join";
      c.querySelector(".fork-create-body").hidden = which !== "create";
      $id("fork-join").classList.toggle("active", which === "join");
      $id("fork-create").classList.toggle("active", which === "create");
    }
    const showErr = (id, msg) => { const e = $id(id); if (e) e.textContent = msg || ""; };

    async function withBtn(btn, fn) {
      if (btn) btn.disabled = true;
      try { await fn(); } finally { if (btn) btn.disabled = false; }
    }

    function wireAuthUI() {
      $id("auth-to-join")?.addEventListener("click", () => { setAuthView("join"); setForkBody("join"); });
      $id("auth-to-login")?.addEventListener("click", () => setAuthView("login"));
      $id("fork-join")?.addEventListener("click", () => setForkBody("join"));
      $id("fork-create")?.addEventListener("click", () => setForkBody("create"));

      $id("auth-login-btn")?.addEventListener("click", (e) => withBtn(e.target, async () => {
        showErr("auth-err", "");
        try { await login($id("auth-email").value.trim(), $id("auth-pw").value); }
        catch (err) { showErr("auth-err", err?.status === 400 ? "이메일 또는 비밀번호가 올바르지 않습니다" : "로그인 실패 — 연결을 확인하세요"); throw err; }
      }).catch(() => {}));

      $id("auth-google-btn")?.addEventListener("click", (e) => withBtn(e.target, async () => {
        showErr("auth-err", "");
        try { await loginGoogle(); } catch (err) { showErr("auth-err", "구글 로그인 준비 중 — 관리자에게 문의하세요"); throw err; }
      }).catch(() => {}));

      $id("auth-demo-btn")?.addEventListener("click", (e) => withBtn(e.target, async () => {
        try { await loginDemo(); } catch (err) { showErr("auth-err", "데모 연결 실패 — 잠시 후 다시 시도"); throw err; }
      }).catch(() => {}));

      $id("join-submit")?.addEventListener("click", (e) => withBtn(e.target, async () => {
        showErr("join-err", "");
        try {
          await signupJoin({ name: $id("join-name").value.trim(), email: $id("join-email").value.trim(),
                             pw: $id("join-pw").value, code: $id("join-code").value });
        } catch (err) { showErr("join-err", err?.message || "합류 실패"); throw err; }
      }).catch(() => {}));

      $id("create-submit")?.addEventListener("click", (e) => withBtn(e.target, async () => {
        showErr("create-err", "");
        try {
          const code = await signupCreate({ name: $id("create-name").value.trim(), email: $id("create-email").value.trim(),
                                            pw: $id("create-pw").value, clinicName: $id("create-clinic").value.trim() });
          // Surface the join code so the new 원장 can share it.
          alert("클리닉이 생성되었습니다. 직원 참여 코드: " + code);
        } catch (err) { showErr("create-err", err?.message || "생성 실패"); throw err; }
      }).catch(() => {}));
    }
```

- [ ] 2. Add a session reaction that opens/closes the auth gate and refreshes shared tabs. Register in `boot()`:

```js
    function reflectSession() {
      // OAuth users with no clinic yet → push them into the join fork.
      if (pb && pb.authStore.isValid && !Session.clinic) { setAuthView("join"); setForkBody("join"); showAuth(); return; }
      if (Session.valid) { hideAuth(); paintSessionChrome(); }
      else { showAuth(); }
    }
    function paintSessionChrome() {
      // Topbar role/clinic chip + a logout affordance (reuse existing topbar slot).
      const msg = $id("sync-msg");
      if (msg && Session.user) msg.textContent = (Session.isDemo() ? "데모 모드 · " : "") + (Session.role || "직원");
      // A logout button is added to .rail-foot in step 3.
    }
```

- [ ] 3. Add a logout button + role banner to the rail foot (HTML, near line 2739) and wire it:

```html
        <button class="rail-btn" id="rail-logout" style="display:none">⎋ 로그아웃</button>
```
```js
      $id("rail-logout")?.addEventListener("click", () => { logout(); });
      onAuthChange(() => {
        const lo = $id("rail-logout"); if (lo) lo.style.display = Session.valid ? "" : "none";
        reflectSession();
        // Shared tabs re-fetch on auth change (Phase 2+ register here).
      });
```

- [ ] 4. In `boot()`, call `wireAuthUI()` and run `reflectSession()` after the health check resolves. **Do not gate the local tools** — the auth scrim is an overlay; the page beneath it still loads. Add:

```js
      wireAuthUI();
      // After getPB()/health resolves (existing code), decide the gate:
      reflectSession();
```

> **Local-first nuance:** if `getPB()` returns `null` (CDN/backend down), `Session.valid` is `false` and `reflectSession()` would `showAuth()`. That is wrong for the offline case — a viewer offline should still reach the local tools. **Rule:** only `showAuth()` when `online === true` (backend reachable) OR there is a persisted-but-stale token. When fully offline, `hideAuth()` and let the local tools run with the "오프라인 — 이 기기에서만" indicator. Encode this in `reflectSession()`: `if (!online && !pb?.authStore.isValid) { hideAuth(); return; }`.

---

## Task 1.5 — Phase 1 verification (node --check + Playwright auth smoke)

**Files:** `clinic-admin/_smoke_auth.mjs` (temp, untracked, delete at end)

- [ ] 1. `node --check` the whole module again (Task 1.2 step 5 command) → `OK`.

- [ ] 2. Write `clinic-admin/_smoke_auth.mjs` (run from a FILE, not `node -e`):

```js
import { chromium } from "playwright";
const EXE = "/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome";
const URL = "file://" + process.cwd() + "/index.html";
const b = await chromium.launch({ executablePath: EXE });
const p = await b.newPage();
const logs = []; p.on("console", m => logs.push(m.text()));
await p.goto(URL, { waitUntil: "networkidle" });
// Auth scrim should be visible for a first-time (logged-out) visitor when online.
await p.waitForTimeout(2500);
const scrimOpen = await p.evaluate(() => document.getElementById("auth-scrim")?.classList.contains("open"));
console.log("AUTH_SCRIM_OPEN:", scrimOpen);
// Demo login → authStore valid + clinic resolved.
await p.click("#auth-demo-btn");
await p.waitForTimeout(3000);
const sess = await p.evaluate(() => ({ valid: window.__intake?.pb?.authStore?.isValid, clinic: window.__intake?.pb?.authStore?.model?.clinic, role: window.__intake?.pb?.authStore?.model?.role }));
console.log("DEMO_SESSION:", JSON.stringify(sess));
await b.close();
```
(Note: expose `Session`/auth on `window.__intake` in Task 1.4 by extending the existing `window.__intake = {...}` object with `get authStore(){...}`, or rely on `pb.authStore` as above. Add whatever the smoke reads.)

- [ ] 3. Run it (real backend — seeded demo data persists):
```bash
cd /home/ubuntu/projects/vibe-demos/clinic-admin
NODE_PATH=/tmp/node_modules node _smoke_auth.mjs
rm -f _smoke_auth.mjs
```
Expected: `AUTH_SCRIM_OPEN: true`, then `DEMO_SESSION: {"valid":true,"clinic":"<id>","role":"원장"}`.

**Phase 1 manual verification checklist:**
- [ ] Logged-out + online → auth scrim shown over the (still-rendered) page.
- [ ] Demo button → scrim closes, role chip reads "데모 모드 · 원장".
- [ ] 회원가입 → JOIN/CREATE tabs toggle; JOIN with `DEMO-0000` resolves the demo clinic as 직원.
- [ ] CREATE makes a clinic and alerts a fresh join code; the new user is 원장.
- [ ] Backend down (block the PB domain) → page loads, local tools work, NO auth wall, "오프라인" indicator.
- [ ] Logout returns to the auth scrim.

---

# PHASE 2 — Realtime 접수 현황판 (00) clinic-scoped · FULL CODE

**Outcome:** `intake_card` carries a `clinic` relation; rules scope it to `@request.auth.clinic`; the existing `subscribe('*')` is completed with a clinic filter, hardened lifecycle (sentinel + `_subAborted` + visibility re-subscribe), and the UI relabels player→스테이션. The board still falls back to local seed when logged out/offline.

## Task 2.1 — Migration `004_intake_card_clinic.js`

**Files:** `clinic-admin/pb/pb_migrations/004_intake_card_clinic.js` (new)

- [ ] 1. Add a `clinic` relation to `intake_card` and tighten rules from open (`""`) to clinic-scoped. **Existing rows have no clinic** — backfill them to the demo clinic in the migration so the seed board keeps working:

```js
// clinic-admin/pb/pb_migrations/004_intake_card_clinic.js
// Scope the live intake board to a clinic. Existing open rows are
// backfilled to 데모 클리닉 so the demo board survives the rule change.
migrate((app) => {
  const col = app.findCollectionByNameOrId("intake_card");
  let demo;
  try { demo = app.findFirstRecordByData("clinic", "join_code", "DEMO-0000"); } catch (e) { demo = null; }
  if (!col.fields.find((f) => f.name === "clinic")) {
    const clinic = app.findCollectionByNameOrId("clinic");
    col.fields.add(new Field({ type: "relation", name: "clinic", required: false, maxSelect: 1, collectionId: clinic.id, cascadeDelete: true }));
  }
  // Clinic-scoped; any clinic member may create/advance/clear (collaborative board).
  col.listRule = col.viewRule = "@request.auth.clinic != '' && clinic = @request.auth.clinic";
  col.createRule = "@request.auth.clinic != '' && clinic = @request.auth.clinic";
  col.updateRule = "@request.auth.clinic != '' && clinic = @request.auth.clinic";
  col.deleteRule = "@request.auth.clinic != '' && clinic = @request.auth.clinic";
  app.save(col);
  // Backfill existing rows to the demo clinic.
  if (demo) {
    const rows = app.findRecordsByFilter("intake_card", "clinic = '' || clinic = null", "", 0, 0);
    for (const r of rows) { r.set("clinic", demo.id); app.save(r); }
  }
}, (app) => {
  const col = app.findCollectionByNameOrId("intake_card");
  col.listRule = col.viewRule = col.createRule = col.updateRule = col.deleteRule = "";
  try { col.fields.removeByName("clinic"); } catch (e) {}
  app.save(col);
});
```

- [ ] 2. `node --check` → `OK`. Deploy via `./sync-backends.sh` and confirm health.

## Task 2.2 — Scope the board to the session clinic + harden subscribe lifecycle

**Files:** `clinic-admin/index.html` (the module).

- [ ] 1. Replace the board's `boot()` data path so it only goes live when `Session.valid`, filters by clinic, and re-fetches/re-subscribes on auth change. Add a `_subAborted` teardown flag + sentinel-guarded subscribe (mirror live-globe):

```js
    let _subAborted = false, _subToken = 0;

    async function teardownSub() {
      _subAborted = true;
      if (_sub) { try { (await _sub)(); } catch (e) {} _sub = null; }
    }

    async function subscribeLive(c, token) {
      // Sentinel: ignore if a newer subscribe started or we tore down.
      _sub = c.collection("intake_card").subscribe("*", (e) => {
        if (_subAborted || token !== _subToken) return;
        // Defense-in-depth: rules already scope, but ignore cross-clinic.
        if (e.record && Session.clinic && e.record.clinic !== Session.clinic) return;
        if (e.action === "delete") cards.delete(e.record.id);
        else cards.set(e.record.id, e.record);
        render(e.action === "create" || e.action === "update" ? e.record.id : null);
      });
    }

    async function loadBoardForClinic() {
      const c = await getPB();
      if (!c || !Session.valid) { runLocalBoard(); return; }
      _subAborted = false; const token = ++_subToken;
      try {
        const flt = `clinic="${Session.clinic}"`;
        const rows = await c.collection("intake_card").getFullList({ sort: "created", filter: flt });
        cards = new Map(rows.map((r) => [r.id, r]));
        if (cards.size === 0 && Session.isDemo()) {
          for (const s of seedCards()) {
            try { await c.collection("intake_card").create({ patient_name: s.patient_name, status: s.status, summary: s.summary, player_id: s.player_id, clinic: Session.clinic }); } catch (e) {}
          }
          const seeded = await c.collection("intake_card").getFullList({ sort: "created", filter: flt });
          cards = new Map(seeded.map((r) => [r.id, r]));
        }
        online = true; setSync(true, "실시간 동기화 중");
        render();
        await subscribeLive(c, token);
      } catch (e) { online = false; setSync(false, "오프라인 — 이 기기에서만"); runLocalBoard(); }
    }

    function runLocalBoard() {
      const stored = loadLocal();
      const list = (stored && stored.length) ? stored : seedCards();
      cards = new Map(list.map((r) => [r.id, r]));
      if (!stored) saveLocal(Array.from(cards.values()));
      setSync(false, online ? "실시간 동기화 중" : "오프라인 — 이 기기에서만");
      render();
    }
```

- [ ] 2. Inject `clinic: Session.clinic` into the `addCard()` create payload (only the online branch); the offline branch keeps no clinic. Gate online mutations on `Session.valid`.

- [ ] 3. Re-fetch + re-subscribe on auth change; tear down on logout; re-subscribe on tab re-focus:

```js
      onAuthChange(async () => {
        await teardownSub();
        if (Session.valid) { await loadBoardForClinic(); }
        else { runLocalBoard(); }
      });
      document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && Session.valid && !_sub) {
          await teardownSub(); await loadBoardForClinic();
        }
      });
```

- [ ] 4. Relabel player→스테이션 in the UI strings only (the `.mine-tag` text "내가 추가" → keep, or "내 스테이션"; the add-note copy mentions 스테이션). Column labels (대기/진료중/완료) unchanged. No column rename in the DB (spec §10 lean).

## Task 2.3 — Phase 2 verification

**Files:** `clinic-admin/_smoke_board.mjs` (temp)

- [ ] 1. `node --check` the module → `OK`.
- [ ] 2. Playwright smoke: demo-login, assert the board fetched clinic-scoped rows, create a card, assert it appears, assert `clinic` is set:

```js
import { chromium } from "playwright";
const EXE = "/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome";
const b = await chromium.launch({ executablePath: EXE });
const p = await b.newPage(); await p.goto("file://" + process.cwd() + "/index.html", { waitUntil: "networkidle" });
await p.waitForTimeout(2000); await p.click("#auth-demo-btn"); await p.waitForTimeout(3500);
await p.fill("#intake-name", "스모크테스트환자"); await p.click("#intake-add-btn"); await p.waitForTimeout(2500);
const r = await p.evaluate(() => { const c = [...window.__intake.cards.values()]; const mine = c.find(x => x.patient_name === "스모크테스트환자"); return { count: c.length, allScoped: c.every(x => x.clinic === window.__intake.pb.authStore.model.clinic), mineClinic: mine?.clinic }; });
console.log("BOARD:", JSON.stringify(r)); await b.close();
```
- [ ] 3. Run with `NODE_PATH=/tmp/node_modules`, then `rm -f _smoke_board.mjs`. Expected: `allScoped:true`, `mineClinic` = demo clinic id.

**Phase 2 manual checklist:**
- [ ] Two tabs, both demo-logged-in → a card added in tab A appears live in tab B.
- [ ] Logout mid-session → board falls back to local seed, indicator → 오프라인.
- [ ] Re-login → board re-fetches clinic rows, re-subscribes (no duplicate handlers — check console for single subscribe).

---

# PHASE 3 — 면허 명부 (08) + 인증 체크리스트 (09) · TASK-GRANULAR + REPRESENTATIVE CODE

> **Pattern note:** Phases 3–5 reuse Phase 2's shape: a clinic-scoped collection (migration declares `clinic` relation + autodate + rules), and a render that **swaps `Store.get(key)` for a clinic-scoped `getFullList({filter:'clinic="..."'})` when `Session.valid`, else local**. Phase 3 also builds the **shared import/export + presence helper** that Phases 4–5 reuse. Representative code is given for the one new mechanism per phase; the repeated clinic-scoped CRUD follows Phase 2 verbatim.

## Task 3.1 — Migration `005_license_accred.js`

**Files:** `clinic-admin/pb/pb_migrations/005_license_accred.js` (new)

- [ ] 1. Create both collections. `license` is **원장-write-gated** (spec §3.3); `accred_item` is any-member-write (collaborative checklist). Both clinic-scoped + autodate. Representative migration body (mirror the field tables in the spec):

```js
// clinic-admin/pb/pb_migrations/005_license_accred.js
migrate((app) => {
  const clinic = app.findCollectionByNameOrId("clinic");
  const scoped = "@request.auth.clinic != '' && clinic = @request.auth.clinic";
  const ownerWrite = scoped + " && @request.auth.role = '원장'";

  const license = new Collection({
    type: "base", name: "license",
    listRule: scoped, viewRule: scoped,
    createRule: ownerWrite, updateRule: ownerWrite, deleteRule: ownerWrite,
    fields: [
      { type: "relation", name: "clinic", required: true, maxSelect: 1, collectionId: clinic.id, cascadeDelete: true },
      { type: "text",   name: "staff_name", required: true, max: 40 },
      { type: "text",   name: "kind", max: 20 },          // 한의사/간호사/…
      { type: "text",   name: "license_no", max: 40 },
      { type: "date",   name: "expires_on" },
      { type: "date",   name: "last_report_on" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(license);

  const accred = new Collection({
    type: "base", name: "accred_item",
    listRule: scoped, viewRule: scoped,
    createRule: scoped, updateRule: scoped, deleteRule: scoped,   // collaborative
    fields: [
      { type: "relation", name: "clinic", required: true, maxSelect: 1, collectionId: clinic.id, cascadeDelete: true },
      { type: "text",   name: "domain", max: 20 },        // 안전/환자권리/의무기록/감염관리/시설/인사
      { type: "text",   name: "label", required: true, max: 200 },
      { type: "bool",   name: "done" },
      { type: "text",   name: "checked_by", max: 40 },
      { type: "date",   name: "checked_at" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(accred);
}, (app) => {
  for (const n of ["license", "accred_item"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) {} }
});
```
- [ ] 2. `node --check` → `OK`; deploy; confirm health.

## Task 3.2 — Shared `Hosted` helper + import/export/presence (build once, reuse in 4–5)

**Files:** `clinic-admin/index.html` (module).

- [ ] 1. Add a small `Hosted` factory that wraps the clinic-scoped CRUD + local fallback for any collection, so each shared tab is a few lines. Representative shape:

```js
    // Generic clinic-scoped collection helper with local-first fallback.
    // localKey = the existing Store key so offline reads the same data.
    function Hosted(collectionName, localKey) {
      return {
        async list() {
          const c = await getPB();
          if (c && Session.valid) {
            try { return await c.collection(collectionName).getFullList({ sort: "created", filter: `clinic="${Session.clinic}"` }); }
            catch (e) {}
          }
          return Store.get(localKey, []) || [];
        },
        async create(data) {
          const c = await getPB();
          if (c && Session.valid) { try { return await c.collection(collectionName).create({ ...data, clinic: Session.clinic }); } catch (e) {} }
          const arr = Store.get(localKey, []) || []; const rec = { id: "local-" + crypto.randomUUID(), ...data }; arr.push(rec); Store.set(localKey, arr); return rec;
        },
        async update(id, data) {
          const c = await getPB();
          if (c && Session.valid && !String(id).startsWith("local-")) { try { return await c.collection(collectionName).update(id, data); } catch (e) {} }
          const arr = (Store.get(localKey, []) || []).map((r) => r.id === id ? { ...r, ...data } : r); Store.set(localKey, arr);
        },
        async remove(id) {
          const c = await getPB();
          if (c && Session.valid && !String(id).startsWith("local-")) { try { await c.collection(collectionName).delete(id); return; } catch (e) {} }
          Store.set(localKey, (Store.get(localKey, []) || []).filter((r) => r.id !== id));
        },
        subscribe(onChange) {
          // Sentinel-guarded, clinic-filtered; returns an unsubscribe.
          let token = ++_subToken, aborted = false, unsub = null;
          getPB().then(async (c) => {
            if (!c || !Session.valid) return;
            unsub = await c.collection(collectionName).subscribe("*", (e) => {
              if (aborted || (e.record && e.record.clinic !== Session.clinic)) return;
              onChange(e);
            });
          });
          return () => { aborted = true; if (unsub) try { unsub(); } catch (e) {} };
        },
      };
    }
```

- [ ] 2. Add CSV import/export helpers (default; zero-dep) + an optional `.xlsx` export using the already-loaded `XLSX` global. Representative:

```js
    function toCSV(rows, cols) {
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    }
    function downloadCSV(name, rows, cols) {
      const blob = new Blob(["﻿" + toCSV(rows, cols)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    }
    function parseCSV(text) { /* minimal RFC-4180 parse → array of objects keyed by header row */ }
    // .xlsx (optional) — XLSX is already loaded globally (head line 23):
    function downloadXLSX(name, rows) {
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "data"); XLSX.writeFile(wb, name);
    }
```

- [ ] 3. Add a presence line renderer: subscribe events update a "● {checked_by/staff}님이 방금 N개 수정" line per shared tab, debounced ~4s (reuse the `SyncStatus.peer()` 4s-fade idiom).

## Task 3.3 — Wire 면허 명부 (08) to `Hosted('license', 'license.list')`

**Files:** `clinic-admin/index.html` — the existing license render (`renderLicense`-style code around lines 6623–6780, reading `Store.get("license.list", [])`).

- [ ] 1. Replace the synchronous `Store.get("license.list")` reads with `await licenseHosted.list()` (`const licenseHosted = Hosted("license", "license.list")`). Map existing local fields (`name`→`staff_name`, `role`→`kind`, `expiry`→`expires_on`, `cme`→`last_report_on`) — **add a field-mapping shim** so the existing render template is reused unchanged where possible.
- [ ] 2. Gate the add/delete buttons + OCR-autofill writes through `licenseHosted.create/remove`. **Hide write controls for 직원** (server enforces it; UI mirrors it): if `!Session.isOwner()`, disable the add form + delete buttons with a "원장만 편집할 수 있습니다" note. Reads still render for 직원.
- [ ] 3. Subscribe (`licenseHosted.subscribe`) → re-render on remote change + update the presence line. Re-fetch on `onAuthChange`. D-day computation uses `pbDate(expires_on)` (space-swap).
- [ ] 4. Add `⬆ 가져오기 / ⬇ 내보내기` buttons to the existing `.result-toolbar` (line 3476): export current roster to CSV (and an "Excel(.xlsx)" option), import a CSV to bulk-create (원장 only).
- [ ] 5. **textContent only** for `staff_name`/`license_no` in the render (the existing render uses an `innerHTML` template string at line 6657 — convert the record-value insertions to `textContent` node-building, or escape — this is a required XSS fix when the source becomes shared/remote data).

## Task 3.4 — Wire 인증 체크리스트 (09) to `Hosted('accred_item', ...)`

**Files:** `clinic-admin/index.html` — accred render (around lines 6860+, reading `Store.get("accred.checked", {})`, a map of id→bool).

- [ ] 1. **Model shift:** the local version stores only a checked-map over a static item list; the shared version needs one `accred_item` row per checklist item (so `checked_by`/`checked_at`/`done` sync). On first clinic load, if the collection is empty for this clinic, **seed it from the static item list** (the same list the UI already renders) — one create per item (any member may create). After that, toggling a checkbox is `accredHosted.update(id, { done, checked_by: Session.user.name, checked_at: today })`.
- [ ] 2. Subscribe → live % complete + "누가 체크했는지" presence. Re-fetch on auth change. Any member may toggle (collaborative rule).
- [ ] 3. Live progress bar (`#accred-bar`) + summary (`#accred-summary`) + the 오늘-tab insight (`#ins-accred`) recompute from the hosted rows.
- [ ] 4. textContent for `checked_by` in the per-item meta line.

## Task 3.5 — Phase 3 verification

- [ ] 1. `node --check` the module → `OK`.
- [ ] 2. Playwright smoke (`_smoke_license.mjs`): demo-login (role 원장), add a license row, assert it persists clinic-scoped; then **assert role enforcement** — create a *직원* test user via the JOIN flow against `DEMO-0000`, attempt a `license.create`, expect a 403/rejection:

```js
// after demo-login as 원장: add license, assert created
// then: signupJoin a throwaway 직원, attempt license create via pb, expect error
const owner = await p.evaluate(async () => { const c = window.__intake.pb; const r = await c.collection("license").create({ staff_name: "스모크한의사", kind: "한의사", clinic: c.authStore.model.clinic }); return r.id; });
const denied = await p.evaluate(async () => {
  const c = window.__intake.pb; const em = "staff" + Date.now() + "@x.demo";
  await c.collection("users").create({ name: "직원테스트", email: em, password: "pw12345678", passwordConfirm: "pw12345678" });
  await c.collection("users").authWithPassword(em, "pw12345678");
  const clinic = await c.collection("clinic").getFirstListItem('join_code="DEMO-0000"');
  await c.collection("users").update(c.authStore.model.id, { clinic: clinic.id, role: "직원" });
  await c.collection("users").authRefresh();
  try { await c.collection("license").create({ staff_name: "막힘", clinic: clinic.id }); return "ALLOWED_BUG"; } catch (e) { return "DENIED_" + e.status; }
});
console.log("OWNER_CREATE:", owner, "STAFF_WRITE:", denied);
```
Expected: `OWNER_CREATE: <id>`, `STAFF_WRITE: DENIED_403` (or `DENIED_400`). **This is the load-bearing role-rule assertion.**
- [ ] 3. `rm -f _smoke_license.mjs`.

**Phase 3 manual checklist:**
- [ ] 원장 adds a 면허 row → 직원 in another tab sees it (read), cannot edit (controls disabled + server 403).
- [ ] Accred toggle in tab A → live % + "누가 체크" in tab B.
- [ ] Export CSV opens with the current roster; import CSV bulk-adds (원장).
- [ ] Offline → both tabs fall back to local Store, no errors.

---

# PHASE 4 — Hosted reference data: 01 KCD + 04 비급여 · TASK-GRANULAR + REPRESENTATIVE CODE

> Same shape as Phase 3, **both 원장-write-gated** reference tables (spec §3.3). The new mechanism here is **import-once → hosted → joint-edit → anyone-exports** against a *reference* table that previously lived in a static JSON (`data/kcd9.json`, `data/bigeup.json`). Reuse the `Hosted` helper + CSV/xlsx + presence from Phase 3 verbatim.

## Task 4.1 — Migration `006_reference_tables.js`

**Files:** `clinic-admin/pb/pb_migrations/006_reference_tables.js` (new)

- [ ] 1. Create `kcd_code` and `bigeup_item`, both clinic-scoped + autodate, **원장-write-gated** (`ownerWrite` rule from Phase 3). Fields per spec:
  - `kcd_code`: `code` (text), `name_ko` (text), `note` (text) + `clinic` + autodate.
  - `bigeup_item`: `name` (text), `price` (number, min 0), `category` (text) + `clinic` + autodate.
  - Body mirrors `005` exactly (swap field lists + collection names). `node --check` → `OK`; deploy.

## Task 4.2 — Wire 01 KCD-8 정비 to `Hosted('kcd_code', ...)`

**Files:** `clinic-admin/index.html` (KCD tab, panel `tab-kcd` line 2889+; current logic reads `data/kcd9.json` via `loadJSON` line 4832).

- [ ] 1. Keep the static `kcd9.json` as the **lookup/validate reference** (06 코드 검색 stays local). The *editable hosted table* is a separate "우리 병원 코드표" view: `kcdHosted = Hosted("kcd_code", "kcd.table")`.
- [ ] 2. **Import-once:** an `⬆ 가져오기` flow that bulk-creates the clinic's table from either the bundled JSON ("표준 KCD-8로 시작") or an uploaded CSV (원장 only). After import, the team shares; anyone exports the current state (`⬇ 내보내기` CSV/xlsx).
- [ ] 3. 직원 read-only (controls disabled + note); subscribe for live edits + presence; re-fetch on auth change; textContent for `code`/`name_ko`/`note`.

## Task 4.3 — Wire 04 비급여 반기보고 to `Hosted('bigeup_item', ...)`

**Files:** `clinic-admin/index.html` (비급여 tab `tab-bigeup` line 3145+; reads `data/bigeup.json`).

- [ ] 1. `bigeupHosted = Hosted("bigeup_item", "bigeup.list")`. Shared dataset assembled jointly; the existing 심평원-format export is regenerated from hosted rows (CSV default; xlsx via the loaded `XLSX` global for the 요양기관업무포털 upload shape if the existing export already produced xlsx — match the existing export format).
- [ ] 2. 원장-write-gated add/edit; subscribe + presence; re-fetch on auth change; `price` rendered with existing number formatting; textContent for `name`/`category`.

## Task 4.4 — Phase 4 verification

- [ ] 1. `node --check` → `OK`.
- [ ] 2. Playwright smoke (`_smoke_ref.mjs`): demo-login 원장, import 2 kcd rows, assert clinic-scoped list returns them; assert a 직원 cannot create (same role-denial pattern as Phase 3); export CSV produces a non-empty blob (assert `download` attribute fired). `rm` after.

**Phase 4 manual checklist:**
- [ ] Import-once seeds the clinic table; second device sees it without re-import.
- [ ] 원장 edits a code/price → 직원 sees update live, cannot edit.
- [ ] Export round-trips (export CSV → re-import → same rows).
- [ ] Offline → static JSON lookup (06/validate) still works; hosted table shows offline state.

---

# PHASE 5 — 자보 삭감 ledger (02) · TASK-GRANULAR + REPRESENTATIVE CODE

> Aggregate-only shared ledger — **no patient detail ever reaches the server** (spec §6). The local 자보 tab keeps processing individual claims (PII) on-device; only PII-stripped aggregates (`insurer`, `reason`, `month`, `amount`) persist. Any clinic member may write (collaborative trend-building). Same `Hosted` + export pattern.

## Task 5.1 — Migration `007_jabo_ledger.js`

**Files:** `clinic-admin/pb/pb_migrations/007_jabo_ledger.js` (new)

- [ ] 1. Create `jabo_deduction`, clinic-scoped + autodate, **any-member-write** (`scoped` rule, not ownerWrite). Fields: `insurer` (text), `reason` (text), `month` (text, YYYY-MM, max 7), `amount` (number, min 0) + `clinic` + autodate. Body mirrors `005`. `node --check` → `OK`; deploy.

## Task 5.2 — Wire 02 자보 정산 aggregate ledger

**Files:** `clinic-admin/index.html` (자보 tab `tab-jabo` line 2954+).

- [ ] 1. **Keep the existing per-claim local processing intact** (the PII path — patient name/주민번호 never leave the device). Add a new "삭감 추세 (병원 공용)" section that records only the aggregate row when a deduction is confirmed: `jaboHosted.create({ insurer, reason, month, amount })`. No patient fields in the payload — assert this explicitly in code comments.
- [ ] 2. Render the shared trend as a grouped-by-insurer/month aggregate (reuse the existing 삭감률 insight on the 오늘 tab — `#ins-cut`/`#ins-jabo` — now fed from hosted rows when `Session.valid`, else local). Subscribe + presence; re-fetch on auth change.
- [ ] 3. Export the aggregate ledger CSV/xlsx (no PII). textContent for `insurer`/`reason`.

## Task 5.3 — Phase 5 verification

- [ ] 1. `node --check` → `OK`.
- [ ] 2. Playwright smoke (`_smoke_jabo.mjs`): demo-login, create an aggregate row, assert clinic-scoped fetch returns it, **assert the payload has no patient fields** (`evaluate` the created record keys ⊆ `{id,collectionId,collectionName,clinic,insurer,reason,month,amount,created,updated}`). `rm` after.

**Phase 5 manual checklist:**
- [ ] Confirming a deduction in the local claim tool adds an aggregate row visible clinic-wide.
- [ ] No patient name/주민번호 ever appears in a `jabo_deduction` record (inspect in PB admin).
- [ ] 오늘-tab 삭감률 insight reflects hosted aggregates when logged in; local when offline.

---

## Final cross-phase tasks

- [ ] **SW cache bump:** `clinic-admin/sw.js` line 2: `vibe-clinic-admin-v15` → `v16` (do once, on the first phase that ships). Confirm the cross-origin skip (line ~30) is intact.
- [ ] **Welcome copy update** (spec §6): replace the privacy sentence in `#welcome-title`/`.deck` (line 2654) and the 오늘-tab caveat (line 2882) with the sharpened copy: *"우리 병원 팀이 함께 쓰는 행정 데이터 — 로그인한 직원만 봅니다. 환자 식별정보는 여전히 이 기기 안에서만 처리되고, 서버에는 집계·결과만 올라갑니다."*
- [ ] **Deploy each new migration** with `./sync-backends.sh` from the repo root as its phase lands; confirm `curl https://clinic-admin.pb.gurum.se/api/health` → 200.
- [ ] **OAuth out-of-band config** (one-time, not code): in PB admin (`https://clinic-admin.pb.gurum.se/_/` → Settings → Auth providers → Google) set client id/secret + redirect URL. The Google button works once enabled; until then it shows the "준비 중" message.

---

## Self-review note (read before building)

1. **PB 0.25 JSVM seed APIs (Task 1.1) — confirm before running.** The migration uses `Record`, `new Record(collection)`, `setPassword`, `findAuthRecordByEmail`, `findFirstRecordByData`, `findRecordsByFilter`, and creating an auth collection via `new Collection({type:"auth", name:"users"})`. These are the documented 0.25 JSVM names, but **a human should confirm against the deployed binary's JSVM** (`https://pocketbase.io/jsvm/` for the pinned version, or `ssh pb-backends` and check) before the first deploy — the seed/auth-extend block is the only PB-version-sensitive code in the plan. If PB already ships a non-empty default `users` collection with a different id, the "look up by name, add fields if missing" approach handles it; if the default `users` is *non-auth* on this build (it is not, but verify), the create branch would conflict — confirm.

2. **`clinic.createRule` vs signup chicken-and-egg (resolved).** A self-signing-up 원장 must create a clinic, but `createRule` requires auth. Resolved by ordering: create user → authWithPassword → create clinic → patch user. The plan's `signupCreate` follows this. If PB's default email-verification gate blocks `authWithPassword` on an unverified new user, set the `users` collection's auth options to **not require verification for login** (an admin/migration auth-options step) — flag for the implementer to confirm in PB admin (Auth → "Forbid authentication for unverified users" OFF for the demo). Noted as a possible out-of-band toggle, not code.

3. **Demo seed password is in the repo.** `demo-clinic-2026` lives in both the migration and the frontend by design (it's a public demo account, like tinywings' open board). It is **not a secret** — it gates only the shared demo clinic's fictional data. Do not treat it as a leaked credential.

4. **Existing `intake_card` open rules → scoped is a breaking change for anonymous use.** After Phase 2, the board requires login. This is intentional (the spec makes the board clinic-scoped), but it means the previously-anonymous live board now needs the demo login. The local-first fallback covers logged-out viewers. Confirm this is the desired behavior with the user if anonymous board access mattered — the spec §4 retains the board but under the new auth model, so this plan follows the spec.

5. **`window.__intake` exposure for smoke tests.** Phase 1 smoke reads `window.__intake.pb.authStore`. Ensure the existing `window.__intake = {...}` (line 7249) keeps exposing `pb` (it does via `get pb()`); add `Session` if any smoke needs it. These are debug hooks already present — fine to extend.

6. **Things a human should confirm before building:** (a) Google OAuth client credentials exist / who provisions them; (b) whether anonymous (no-login) board access must be preserved (see note 4); (c) PB email-verification toggle for the signup→login flow (note 2); (d) the exact existing 비급여 export format (CSV vs xlsx) so Phase 4 matches it rather than inventing one.
