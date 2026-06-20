# Contraption Lab — Finish the Roadmap (Editor + Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the community level editor (Phase 3) and the three polish items (sound, sprite animation, per-theme art), finishing the entire Contraption Lab roadmap, deployed and verified.

**Architecture:** A new `#/editor` builds a level using the EXISTING level JSON format + `Sim` for test-play, then publishes to a PocketBase `level` collection; `#/browse` lists/plays community levels; counts are DERIVED from append-only `rating` and `play` collections (no JSVM hooks, no author-rule violations). Polish adds a synth `sound.js` SFX layer, render-only sprite spin, and a few per-theme override sprites — all render/UX-only, never touching physics. No build tool; local-first throughout.

**Tech Stack:** Matter.js (vendored), vanilla ES modules, HTML5 Canvas + WebAudio, PocketBase 0.25.8 (port 8100) + JS SDK 0.26.2 (CDN, already in importmap), `bedrock-image-mcp-server` for per-theme art, Playwright/Chromium for QA.

## Global Constraints

- Static files only — NO build tool/framework/package.json/bundler; push to main = deploy.
- **Reuse the level format verbatim:** the editor produces the exact object `validateLevel`/`buildWorld`/`serializeLevel` handle (schema:1; `goal.zone` is CENTER-based {x,y,w,h}); it is stored verbatim in PocketBase `level.data`. No new format.
- **Render-only guarantees:** sprites, spin animation, and sound NEVER change a collision body or the sim. The 14-level headless solvability sweep MUST stay green.
- **Local-first:** editor + Test work with NO backend and offline; Publish/Browse/sound/art degrade to graceful no-ops when unavailable.
- **PocketBase:** new collections via migration `003_init_levels.js` on port 8100 (already registered); query Context7 before writing backend (per CLAUDE.md — confirmed 2026-06-20: `new Collection({...})`, `findCollectionByNameOrId("users")`, relation `{type:"relation",collectionId,maxSelect:1,cascadeDelete}`, `autodate`, `collection.addIndex(name,true,"(a,b)","")`). The default `users` collection exists — reference it, never create it. Counts are DERIVED from `rating`/`play` record counts (no counter mutation on `level`, no JSVM hook).
- **Security:** access via collection rules only; render user text (`title`, `author_name`) with `textContent`, never innerHTML; validate `data` with `validateLevel` before building any `Sim`.
- SDK pinned `pocketbase@0.26.2` (already in importmap); SW skips cross-origin; bump cache + add any new committed assets.
- Tests: pure `?test` suite (currently 72) + the `/tmp/cl-diag` solvability sweep (14 levels) + Playwright real-browser QA. Deploy verification then test-data cleanup (Phase-2 pattern: stop unit, superuser as `pocketbase` user, delete via localhost API, rotate pw).

**Branch `feat/contraption-lab-phase3-editor` (created). Backend deploy uses `./sync-backends.sh` + `ssh pb-backends` (reachable, server 0.25.8). The controller handles the production deploy/cleanup directly (shared box).**

---

## File Structure

```
contraption-lab/
├── pb/pb_migrations/003_init_levels.js   ← level + rating + play collections
├── js/
│   ├── editor.js     ← editor controller (tools, place/move/delete, goal, inventory, Test, Publish, draft autosave)
│   ├── editor.test.js← pure tests (editor state→level JSON, publish gating, thumbnail geometry)
│   ├── browse.js     ← browse screen (tabs, cards w/ canvas thumbnail, open)
│   ├── sound.js      ← synth WebAudio SFX + mute persistence  (POLISH)
│   ├── sound.test.js ← pure tests (mute persistence, name→params)  (POLISH)
│   ├── cloud.js      ← +publishLevel/listLevels/getLevel/recordPlay/playsCount/rateLevel/hasRated/likesCount
│   ├── sprites.js    ← +spin fields; +themeOverrides for hero parts (POLISH)
│   ├── render.js     ← +render-only spin when running (POLISH)
│   ├── engine.js     ← +optional sim.onEvent(name,data) collision/explosion hook (POLISH, no audio import)
│   ├── main.js       ← routing #/editor #/browse #/play/community/<id>; nav buttons; sound wiring; spin time
│   └── level.test.js ← include editorCases + soundCases in ?test
├── assets/parts/<theme>/<part>.png  ← per-theme override sprites (POLISH)
├── index.html        ← editor + browse DOM, nav buttons, mute toggle
└── sw.js             ← cache new modules + per-theme PNGs, bump v4
```

Order: editor backend (1–2) → cloud API (3) → editor UI (4) → browse (5) → routing/integration (6) → editor QA+deploy (7–8) → sound (9) → animation (10) → per-theme art (11) → polish QA (12) → ship (13).

---

### Task 1: `level` + `rating` + `play` migration

**Files:** Create `contraption-lab/pb/pb_migrations/003_init_levels.js`

**Interfaces:** Produces three base collections. `level`: author(relation→users,required,cascadeDelete), author_name(text,≤40), title(text,required,≤60), data(json,required), published(bool), autodate created/updated; rules list/view=`published=true`, create=`@request.auth.id != "" && author = @request.auth.id`, update/delete=`author = @request.auth.id`. `rating`: user(relation→users,required,cascadeDelete), level(relation→level,required,cascadeDelete), value(number); unique index (user,level); list/view=`""`, create=`@request.auth.id != "" && user = @request.auth.id`, update/delete=`user = @request.auth.id`. `play`: level(relation→level,required,cascadeDelete), autodate created; list/view=`""`, create=`""` (anyone can log a play), update/delete=null.

- [ ] **Step 1: Write the migration** (verified PB 0.25.8 syntax)

```js
// contraption-lab/pb/pb_migrations/003_init_levels.js
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const level = new Collection({
    type: "base", name: "level",
    listRule: "published = true", viewRule: "published = true",
    createRule: "@request.auth.id != \"\" && author = @request.auth.id",
    updateRule: "author = @request.auth.id",
    deleteRule: "author = @request.auth.id",
    fields: [
      { type: "relation", name: "author", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "author_name", max: 40 },
      { type: "text", name: "title", required: true, max: 60 },
      { type: "json", name: "data", required: true },
      { type: "bool", name: "published" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(level);

  const rating = new Collection({
    type: "base", name: "rating",
    listRule: "", viewRule: "",
    createRule: "@request.auth.id != \"\" && user = @request.auth.id",
    updateRule: "user = @request.auth.id", deleteRule: "user = @request.auth.id",
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "level", required: true, collectionId: level.id, maxSelect: 1, cascadeDelete: true },
      { type: "number", name: "value", min: 0 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  });
  app.save(rating);
  rating.addIndex("idx_rating_user_level", true, "user, level", "");
  app.save(rating);

  const play = new Collection({
    type: "base", name: "play",
    listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "level", required: true, collectionId: level.id, maxSelect: 1, cascadeDelete: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  });
  app.save(play);
}, (app) => {
  for (const n of ["play", "rating", "level"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_e) {}
  }
});
```

- [ ] **Step 2: Syntax check** — `node --check contraption-lab/pb/pb_migrations/003_init_levels.js && echo OK`. Expected: `OK`.

- [ ] **Step 3: Apply against a throwaway PB 0.25.8** (proves it runs; nothing touches prod). Download PB 0.25.8 into /tmp, copy ALL three contraption-lab migrations (001,002,003) into its pb_migrations, `./pocketbase migrate up`. Expected: all three `Applied`. Then serve + `echo y | ./pocketbase migrate collections` and assert `grep -c '"name": "level"'`, `"rating"`, `"play"`, and `idx_rating_user_level` each = 1. If any fails, fix and repeat.

- [ ] **Step 4: Commit** — `git add contraption-lab/pb/pb_migrations/003_init_levels.js && git commit -m "contraption-lab: level+rating+play collections migration (Phase 3)"`

---

### Task 2: Deploy the backend (controller-run; production-impacting)

**Files:** none (deploy).

**Interfaces:** Produces the three collections live at `https://contraption-lab.pb.gurum.se`.

> CONTROLLER NOTE: run this yourself (not a subagent) since it touches the shared box; verify existing backends stay healthy.

- [ ] **Step 1: Baseline** — `for s in tinywings ai contraption-lab; do curl -s -o /dev/null -w "$s %{http_code}\n" https://$s.pb.gurum.se/api/health; done`. Expected all 200.
- [ ] **Step 2: Deploy** — `cd /home/ubuntu/projects/vibe-demos && ./sync-backends.sh 2>&1 | grep -A3 contraption-lab`. Expected: synced, no error.
- [ ] **Step 3: Verify collections live** — `curl -s 'https://contraption-lab.pb.gurum.se/api/collections/level/records?perPage=1'` returns a JSON `items` object (empty ok, NOT 404); same for `rating`, `play`. Existing backends still 200.
- [ ] **Step 4: No commit** (deploy only); note result in report.

---

### Task 3: cloud.js level/rating/play API

**Files:** Modify `contraption-lab/js/cloud.js`, `contraption-lab/js/cloud.test.js`

**Interfaces:** Consumes `pb`, `cloud`, `user()`. Produces (added to cloud.js):
- `publishLevel({title, data})` → creates a `level` row with `author=user.id`, `author_name=user.name||email`, `published:true`; returns `{ok, id}` or `{ok:false,error}`.
- `listLevels(tab, page=1, perPage=24)` → `tab ∈ {"recent","played","rated"}`; recent = `sort:-created`; played/rated fetch recent then attach counts (see below) and sort client-side; returns `[{id,title,author_name,data,plays,likes}]`.
- `getLevel(id)` → the level record or null.
- `recordPlay(id)` → best-effort `pb.collection("play").create({level:id})` (try/catch, no-op offline).
- `playsCount(id)` / `likesCount(id)` → `getList(1,1,{filter:level="id"}).totalItems` for play / rating.
- `rateLevel(id)` → toggle: if `hasRated`, delete the user's rating row; else create `{user,level:id,value:1}`; returns new liked bool.
- `hasRated(id)` → bool (the user's rating row exists).
- pure helper `levelCard(rec, plays, likes)` → `{id,title,author_name,plays,likes,data}` (testable).

- [ ] **Step 1: Failing tests** — add `cloudLevelCases()` to cloud.test.js asserting `levelCard` shaping (id/title/author_name/plays/likes pass through; missing author_name → "Anonymous"). Run headless → FAIL.
- [ ] **Step 2: Implement** the functions above (mirror the existing `leaderboard`/`bestOf` style: every network call try/wrapped, return safe defaults offline; `levelCard` pure). `publishLevel` sets `author_name = (u.name||u.email||"Anonymous").slice(0,40)`.
- [ ] **Step 3: Tests pass** — headless `cloudLevelCases` green; `node --check js/cloud.js` OK.
- [ ] **Step 4: Commit** — `contraption-lab: cloud API for publish/list/get/play/rate levels`

---

### Task 4: editor.js — build / set goal / inventory / Test / Publish

**Files:** Create `contraption-lab/js/editor.js`, `contraption-lab/js/editor.test.js`; modify `index.html` (editor DOM), `js/level.test.js` (include editorCases)

**Interfaces:** Consumes `PARTS`/`PALETTE_TYPES` (parts.js), `validateLevel`/`serializeLevel`/`cloneLevel` (level.js), `Sim` (engine.js), `drawWorld`/`resizeCanvas` (render.js), `tokens` (theme.js), `publishLevel` (cloud.js), `user`/`mountAccountUI` (auth-ui.js). Produces an `Editor` controller:
- `new Editor(canvas, { onPublished })`; `editor.mount()` builds an empty working level (`{schema:1, world:{w:1280,h:720,gravity:1}, goal:{type:"dwell",object:"ball",zone:{x:1040,y:560,w:160,h:140},ms:500}, fixed:[], start:[], inventory:[]}`); loads draft from `localStorage["cl.draft"]` if present.
- tool modes: `"fixed"|"start"|"goal"|"inventory"`; placement via the input gesture model (tap place / tap-on-part delete / drag move); selected-part angle slider writes `spec.angle`.
- `editor.test()` → `validateLevel(working)`; if ok, build a `Sim`, run inline; on win set `working._solvedInTest=true`.
- `editor.canPublish()` (pure, exported as `canPublish(level, solvedInTest)`) → true iff `validateLevel(level).ok && solvedInTest && level.inventory.length>0`.
- `editor.publish(title)` → guard `canPublish`; require `user()`; `publishLevel({title, data: stripped})` where `stripped` = `cloneLevel(working)` minus editor-only fields (`_solvedInTest`); on success `onPublished(id)`.
- autosave working level (debounced) to `localStorage["cl.draft"]` on each mutation.

- [ ] **Step 1: Failing pure tests** (editor.test.js `editorCases()`): empty working level validates-as-incomplete until a goal+inventory+solved; `canPublish` gating (false when unsolved / empty inventory / invalid; true when all met); a working level round-trips through `serializeLevel`→`JSON.parse`→`validateLevel` ok. Run → FAIL.
- [ ] **Step 2: index.html editor DOM** — an `#editorBar` (tool buttons: Scenery/Objects/Goal/Inventory, Test, Publish, Clear), reuse `#stage`/`#palette`, a `#publishDlg` (title input + Publish/Cancel), an angle slider `#angleSlider`. Hidden unless `#/editor` active.
- [ ] **Step 3: Implement editor.js** per interfaces. Keep placement using the existing input gesture semantics (tap empty=place active type into the active group; tap part=delete; drag=move). Inventory tool: tap a palette type to add/increment its count in `working.inventory`.
- [ ] **Step 4: Tests pass** — headless editorCases green; `node --check js/editor.js` OK.
- [ ] **Step 5: Commit** — `contraption-lab: level editor (build/goal/inventory/test/publish)`

---

### Task 5: browse.js — list + thumbnail + play + like

**Files:** Create `contraption-lab/js/browse.js`; modify `index.html` (browse DOM)

**Interfaces:** Consumes `listLevels`/`getLevel`/`recordPlay`/`rateLevel`/`hasRated`/`playsCount`/`likesCount` (cloud.js), `validateLevel` (level.js), `PARTS`/`makePart` + `drawWorld`-style drawing for thumbnails. Produces:
- `renderBrowse(container, tab)` → fetch `listLevels(tab)`, render a card per level: a small `<canvas>` thumbnail (draw the level's `fixed`+`start` parts via a lightweight offscreen `Sim`/`buildWorld` + `drawWorld` at thumbnail scale), title + author_name (`textContent`), plays + likes counts, a Play button → `location.hash="#/play/community/"+id`. Tabs Recent/Most-played/Top-rated.
- `thumbnailFor(levelData, canvas)` (pure-ish) → builds the world and draws it once to the given canvas (no rAF). Reused for cards.
- `mountLikeButton(el, id)` → reflects `hasRated`, toggles via `rateLevel`, updates the like count.

- [ ] **Step 1: index.html browse DOM** — `#browseScreen` with tab buttons + `#browseGrid`; hidden unless `#/browse`.
- [ ] **Step 2: Implement browse.js**. Thumbnails: create a throwaway `Sim(level)` (build state, no run), call `drawWorld` to an offscreen canvas sized ~320×180, copy to the card canvas. All user text via `textContent`. Graceful empty/offline states.
- [ ] **Step 3: Syntax + a pure test** for `thumbnailFor` geometry (the fit transform is right) added to editor.test.js or a tiny browse case; `node --check js/browse.js` OK; headless ?test green.
- [ ] **Step 4: Commit** — `contraption-lab: browse screen (tabs, canvas thumbnails, like)`

---

### Task 6: routing + nav integration (main.js)

**Files:** Modify `contraption-lab/js/main.js`, `index.html` (nav buttons)

**Interfaces:** Consumes Editor, renderBrowse, getLevel/recordPlay, validateLevel, Sim. Produces extended routing.

- [ ] **Step 1: Extend `route()`** to a screen switch: `#/editor` → show editor screen, `editor.mount()`; `#/browse` → show browse, `renderBrowse(grid, currentTab)`; `#/play/community/<id>` → `getLevel(id)` → `validateLevel` → if ok `loadLevel(data)` + `recordPlay(id)` + show a like button; if invalid → friendly "needs a newer version" card; default/`#/play/<id>` → official as today. Show/hide the play vs editor vs browse DOM per screen.
- [ ] **Step 2: Nav buttons** in the top bar: "✎ Editor" → `#/editor`, "🌐 Browse" → `#/browse`, and a Home/Levels path back. Wire them.
- [ ] **Step 3: Syntax + full headless ?test** (now includes editorCases) → failed:0; `node --check` all js.
- [ ] **Step 4: Commit** — `contraption-lab: routing + nav for editor/browse/community play`

---

### Task 7: SW + docs (editor)

**Files:** Modify `contraption-lab/sw.js`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: SW** — bump `CACHE` to `vibe-contraption-lab-v4`; add `./js/editor.js`, `./js/browse.js` to SHELL; keep cross-origin guard. Verify counts.
- [ ] **Step 2: Docs** — update contraption-lab bullets (README + CLAUDE): Phase 3 community editor shipped (build/test/publish, browse, like; level+rating+play collections, port 8100).
- [ ] **Step 3: Commit** — `contraption-lab: SW v4 + docs for Phase 3 editor`

---

### Task 8: editor E2E verification (controller-run quality gate)

**Files:** none (verification; scratch in /tmp).

- [ ] **Step 1: headless gates** — full `?test` failed:0; solvability sweep 14/14 (editor/browse are additive — existing levels unaffected).
- [ ] **Step 2: Playwright E2E vs LIVE backend** — serve `contraption-lab/`; in headless Chromium: sign up; go to `#/editor`; build a minimal solvable level (place a sloped wall + goal + a start ball + a ramp in inventory) via editor DOM; Test → solve; Publish with a title; assert it appears in `#/browse` Recent; open it (`#/play/community/<id>`); play + Like; assert 0 page/console errors; screenshot. (If editor placement via synthetic events is too fiddly, drive `editor` API methods through `page.evaluate` to construct the level, then exercise the real Publish/Browse/Play UI — the publish→browse→play→like round-trip is the gate.)
- [ ] **Step 3: cleanup** — delete the test `level`/`rating`/`play`/`users` rows created during E2E via the Phase-2 cleanup procedure (stop unit, superuser as `pocketbase` user, delete via localhost:8100 API, rotate pw), leaving the backend clean.
- [ ] **Step 4: record** result in report (no commit).

---

### Task 9: POLISH — sound.js (synth SFX + mute)

**Files:** Create `contraption-lab/js/sound.js`, `contraption-lab/js/sound.test.js`; modify `js/engine.js` (sim.onEvent hook), `js/main.js` (wiring), `index.html` (mute toggle), `js/level.test.js` (soundCases)

**Interfaces:** Produces `sound.js`: `sfx(name)` (name ∈ place/run/win/bounce/explode), `setMuted(b)`/`isMuted()` (localStorage `cl.muted`), pure `sfxParams(name)` → `{freq,dur,type}` (testable without AudioContext). `engine.js`: a `sim.onEvent` optional callback called with `("bounce",{speed})` on Matter `collisionStart` (above a speed threshold) and `("explode")` on TNT detonation — engine never imports sound.

- [ ] **Step 1: Failing tests** (soundCases): `isMuted` defaults false then persists after `setMuted(true)`; `sfxParams("win")` returns a sane object; `sfxParams("nope")` → null. Run → FAIL.
- [ ] **Step 2: Implement sound.js** — lazy `AudioContext` on first `sfx` after a gesture; synth envelopes per `sfxParams`; all guarded so a missing/blocked context is a silent no-op; mute persisted.
- [ ] **Step 3: engine.js onEvent hook** — in `step()`/collision handling, if `this.onEvent`, call it (try/wrapped); add a `collisionStart` listener in buildWorld/Sim that computes relative speed and fires `bounce` above threshold; fire `explode` where TNT detonates. No audio import in engine.
- [ ] **Step 4: main.js wiring** — `sim.onEvent = (n,d)=>sfx(n)` (throttle bounce to ≥80ms + speed gate handled engine-side); `sfx("place")` on placement, `sfx("run")` on Run, `sfx("win")` in onWin; mute toggle button in bar.
- [ ] **Step 5: Tests pass** + `node --check`; **solvability sweep 14/14 unchanged** (onEvent must not alter physics).
- [ ] **Step 6: Commit** — `contraption-lab: synth WebAudio SFX + mute (render-only)`

---

### Task 10: POLISH — sprite spin animation

**Files:** Modify `contraption-lab/js/sprites.js`, `js/render.js`, `js/main.js`, `js/sprites.test.js`

**Interfaces:** sprites.js entries gain optional `spin` (rad/s) for fan(6), pinwheel(4) (parts that should look spinning but whose body barely rotates). render.js: when `opts.running` and a part has `spin` and not reduced-motion, draw its sprite at `body.angle + spin*(opts.now/1000)`; pure helper `spinAngle(base, spin, nowMs, running, reduced)` → angle (testable). main.js passes `opts.now` (timestamp) and `opts.running` (sim.state==="running") into draw.

- [ ] **Step 1: Failing test** — `spinAngle` returns `base` when not running OR reduced-motion; returns `base + spin*now/1000` when running. Run → FAIL.
- [ ] **Step 2: Implement** — add `spin` to fan/pinwheel registry entries; `spinAngle` helper; use it in `drawSprite` (replaces the bare `body.angle` for spin parts); thread `now`/`running` from main.js tick.
- [ ] **Step 3: Tests pass**; `node --check`; sweep 14/14 (render-only).
- [ ] **Step 4: Commit** — `contraption-lab: render-only sprite spin for fan/pinwheel`

---

### Task 11: POLISH — per-theme override sprites (showcase)

**Files:** Create `assets/parts/neon/{ball,fan,goal}.png` + `assets/parts/blueprint/{ball,fan,goal}.png`; modify `js/sprites.js` (themeOverrides), `sw.js`

**Interfaces:** Produces 6 override sprites + populated `themeOverrides`. `resolveSprite`/`preloadSprites` already apply them.

> CONTROLLER NOTE: asset generation (MCP) is controller-run, like the sprite phase.

- [ ] **Step 1: Generate 6 sprites** via `generate_image_sd35` → `remove_background` → `assets/make-sprite.mjs <cut> <part> 256` but write to the theme subdir (run make-sprite then `mv` into `assets/parts/<theme>/`, or pass a themed slug). Neon variants: glowing/neon-outline ball, fan, goal; Blueprint variants: blueprint-ink/line-art ball, fan, goal. Plain neutral bg, no magenta. QC each visually.
- [ ] **Step 2: Populate themeOverrides** in sprites.js: `ball/fan/goal` each get `themeOverrides:{ neon:"./assets/parts/neon/<p>.png", blueprint:"./assets/parts/blueprint/<p>.png" }`.
- [ ] **Step 3: SW** — add the 6 PNGs to SHELL, bump cache to `vibe-contraption-lab-v5`. Verify.
- [ ] **Step 4: Tests** — extend a spriteCases assertion that `resolveSprite("ball","neon").src` includes `neon/`; headless green.
- [ ] **Step 5: Commit** — `contraption-lab: per-theme override sprites for hero parts (neon+blueprint)`

---

### Task 12: POLISH — full real-browser QA

**Files:** none (verification).

- [ ] **Step 1:** headless `?test` failed:0; sweep 14/14.
- [ ] **Step 2: Playwright** across all 4 themes: page boots 0 errors; toggle mute (no errors with audio active during a Run); a spinning part's render-angle changes between two sampled frames; in Neon and Blueprint, `getImage(resolveSprite("ball",theme).src)` is non-null (override loaded); screenshot each theme. Also re-confirm a level still solves with sound+spin active.
- [ ] **Step 3:** review screenshots (override art visible in neon/blueprint; spin reads; no regressions). Fix + re-run if needed.

---

### Task 13: Ship (controller-run)

**Files:** none.

- [ ] **Step 1:** final headless gates green.
- [ ] **Step 2:** merge `feat/contraption-lab-phase3-editor` → main, verify tests on merge, push (deploys frontend; backend already live from Task 2). Delete branch.
- [ ] **Step 3: live verify** — Playwright vs the LIVE site: editor reachable, browse loads, a community publish→play round-trip works (then clean up that test row), sprites/sound/spin work, 0 errors; screenshot. Leave backend clean.
- [ ] **Step 4:** update memory: roadmap finished.

---

## Self-Review

**Spec coverage — Editor spec:** §1 routing→T6; §2 backend (level/rating/play, derived counts)→T1–T3; §3 editor UX (tools/goal/inventory/test/publish/draft/solve-gate)→T4; §4 browse+play+like+thumbnail→T5; §5 security(textContent/validate)/local-first/testing→T3–T8. **Polish spec:** §1 sound→T9; §2 animation→T10; §3 per-theme art→T11; §4 testing/physics-invariance→T9–T12. All covered.

**Placeholder scan:** Migration + cloud signatures + sound/spin helpers are concrete. The editor UI placement and the E2E (T8) are specified at the interface+assertion level with an explicit fallback (drive `editor` API via `page.evaluate` if synthetic placement is fiddly) — appropriate for UI work that needs in-browser iteration, not a vague TODO. The plays/likes "derived from append-only rating/play collections" replaces the spec's tentative JSVM hook with a concrete, simpler mechanism (noted as a deliberate refinement). No TBDs.

**Type consistency:** level format fields (`schema/world/goal/fixed/start/inventory`) match level.js verbatim; goal.zone center-based as in level.js. cloud API names (`publishLevel/listLevels/getLevel/recordPlay/playsCount/likesCount/rateLevel/hasRated/levelCard`) consistent T3↔T5↔T6↔T8. `canPublish(level,solvedInTest)`, `thumbnailFor`, `sfxParams`, `spinAngle` consistent across their tasks. `themeOverrides` shape matches the existing sprites.js `P()` helper. SW cache bumps sequence v4 (T7) → v5 (T11) — intentional, last one wins at ship.

**Risk flagged for executor:** (1) Task 2 deploy + Task 8/13 cleanup touch the shared production box — controller-run, verify other backends stay 200, leave data clean (Phase-2 procedure). (2) Editor placement via synthetic pointer events is the fiddliest UI; the E2E fallback (construct level via `editor` API, exercise real publish/browse/play/like) keeps the *gate* meaningful even if pure-synthetic building is flaky. (3) per-theme art is asset-only; if a variant looks off, regen (seed+1) — never block the roadmap on one sprite.
