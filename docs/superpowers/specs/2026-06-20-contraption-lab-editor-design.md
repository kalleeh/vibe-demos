# Contraption Lab — Phase 3: Community Level Editor design

**Date:** 2026-06-20
**Slug:** `contraption-lab` (Phases 1–2 + sprites shipped; this is Phase 3)
**Builds on:** the game spec, Phase 2 (`js/cloud.js`, port 8100 backend), the sprite system.

## Summary

An in-game level editor: build a level (place fixed scenery + start objects, set the goal
zone, define the player's inventory), **Test** it with the real `Sim`, and **Publish** it to a
PocketBase `level` collection. A **Browse** screen lists community levels (recent / most-played
/ top-rated) and lets anyone play them; a `rating` collection backs likes. Reuses the existing
level JSON format verbatim — no new format — and the existing sprite-on-body renderer.

## Non-negotiable reuse (no new abstractions)

- **Level format unchanged:** the editor produces exactly the Section-3 level object that
  `validateLevel`/`buildWorld`/`serializeLevel` already handle, stored verbatim in PocketBase
  `level.data`. A community level loads through the identical `Sim` path as an official level.
- **Rendering unchanged:** the editor canvas uses `render.js` (sprites on bodies); test-play
  uses `engine.js` `Sim`. No editor-specific physics or drawing.
- **Local-first:** editor + Test work with NO backend (you can build and playtest offline);
  only Publish/Browse need the backend, and they degrade gracefully when it's down.

## Section 1 — Architecture & routing

New screens via the existing hash router in `main.js`:
- `#/editor` — build/test/publish.
- `#/browse` — list + open community levels.
- `#/play/community/<recordId>` — play a published level (fetched from PB, run through `Sim`).

New/changed files:
```
contraption-lab/
├── pb/pb_migrations/003_init_levels.js   ← NEW: level + rating collections
├── js/
│   ├── editor.js   ← NEW: editor controller (tools, place/move/delete, goal, inventory, Test, Publish)
│   ├── browse.js   ← NEW: browse screen (tabs, cards, open)
│   ├── editor.test.js ← NEW: pure-logic tests (editor state → level JSON, validation gating)
│   ├── cloud.js    ← MODIFY: publishLevel/listLevels/getLevel/incrementPlays/rateLevel/hasRated
│   ├── main.js     ← MODIFY: routing for #/editor, #/browse, #/play/community/<id>; nav buttons
│   ├── level.js    ← MODIFY (if needed): a buildFromEditor helper / author field; format itself unchanged
│   └── level.test.js ← MODIFY: include editorCases in ?test
└── index.html      ← MODIFY: editor + browse DOM (toolbars, dialogs), nav entries
```

## Section 2 — Backend (PocketBase, port 8100)

Migration `003_init_levels.js` (reusing the verified Phase-2 syntax: `new Collection`,
`findCollectionByNameOrId("users")`, `autodate`, `addIndex`). **Query Context7 for current
PocketBase syntax before writing** (per CLAUDE.md), as in Phase 2.

`level` collection (base):
- `author` (relation → users, required, cascadeDelete), `author_name` (text, ≤40 —
  denormalized like `progress.display_name`, so the browse list shows names without expanding
  the locked `users` collection), `title` (text, required, ≤60), `data` (json — the level blob),
  `plays` (number, ≥0), `likes` (number, ≥0), `published` (bool), autodate `created`/`updated`.
- Rules: `listRule`/`viewRule` = `published = true` (public read of published levels);
  `createRule` = `@request.auth.id != "" && author = @request.auth.id`;
  `updateRule` = `author = @request.auth.id` (author edits own; play/like increments handled
  carefully — see below); `deleteRule` = `author = @request.auth.id`.

`rating` collection (base):
- `user` (relation → users, required, cascadeDelete), `level` (relation → level, required,
  cascadeDelete), `value` (number, 0 or 1 — a "like"). Unique index on `(user, level)`.
- Rules: `listRule`/`viewRule` = `""` (so a client can check "did I like this");
  `createRule` = `@request.auth.id != "" && user = @request.auth.id`;
  `updateRule`/`deleteRule` = `user = @request.auth.id`.

**Plays/likes counts.** `plays` and `likes` live on the `level` record. Incrementing them needs
a write to a record the user doesn't own — and `updateRule` is author-only. To avoid a JSVM hook
(simplest, matches the local-first ethos), `likes` is **derived**: the browse "top-rated" sort
and the displayed like-count come from counting `rating` records for that level
(`pb.collection('rating').getList(1,1,{filter:level="id"})` returns `totalItems`), not from a
mutable counter on `level`. `plays` is **best-effort**: incremented via a guarded approach — a
small JSVM hook `pb_hooks/plays.pb.js` exposing `POST /api/cl/play/:id` that bumps `plays`
(server-side, no auth needed, rate-bounded by a per-IP nonce in `$app.store`). If the hook proves
fiddly, `plays` falls back to "derived from rating + a coarse client estimate" and the sort uses
`created`/`likes` only. **Decision: ship likes-derived + a plays hook; if the hook can't deploy
cleanly, drop to recent/top-rated tabs and note it.**

## Section 3 — Editor UX & data flow

The editor is a mode of the same canvas. Toolbar (top): a tool selector — **Wall/Ramp/etc.
(fixed scenery)**, **Ball/objects (start)**, **Goal zone**, **Inventory** — plus **Test**,
**Publish**, **Clear**. Bottom palette lists the part types for the active placement tool.

- **Place fixed scenery:** tap to drop a part into `level.fixed[]` (static parts: wall, ramp,
  platform, pipe, wedge, conveyor, fan, trampoline, spring, goal-marker). Drag to move, tap to
  delete (reuse the `input.js` gesture model). Rotation via a selected-part angle slider.
- **Place start objects:** drop dynamic objects (ball tagged `"ball"`, crate, weight, etc.) into
  `level.start[]`.
- **Goal zone:** drag a rectangle; writes `level.goal = {type:"dwell", object:"ball", zone, ms:500}`.
- **Inventory:** pick part types + counts the player will get → `level.inventory[]`.
- **Test:** `validateLevel(current)` → if ok, build a `Sim` and play it inline (Run/Reset);
  a level can't be published until it has been Test-solved at least once (so authors can't
  publish impossible levels — the editor records a `solvedInTest` flag).
- **Publish:** requires sign-in (reuse `auth-ui.js`); prompts for a title; calls
  `cloud.publishLevel({title, data})`. On success, routes to the new community level.
- **Editor state → JSON:** the editor holds a working `level` object and mutates it directly;
  `serializeLevel` is the single source of the stored blob. No parallel representation.

Local draft autosaves to `localStorage["cl.draft"]` so a refresh doesn't lose work.

## Section 4 — Browse & play community levels

- `#/browse`: three tabs — **Recent** (`sort:-created`), **Most played** (`sort:-plays`),
  **Top rated** (sort by like-count; computed by fetching levels then their rating counts, or
  `-likes` if the plays hook also maintains likes). Cards show title, author_name, plays, likes,
  and a tiny thumbnail rendered client-side from `data` (draw the level's fixed parts to an
  offscreen canvas — no stored image). Paginated (load-more).
- Opening a card → `#/play/community/<id>` → `cloud.getLevel(id)` → `validateLevel` →
  `Sim`. On first load, fire the `plays` increment (best-effort). A **like** button calls
  `cloud.rateLevel(id)` (create/delete the user's `rating` row); the heart reflects `hasRated`.
- Unknown future `schema` / part types in a community level → the existing graceful
  "needs a newer version" handling (validateLevel rejects → a friendly card, not a crash).

## Section 5 — Error handling, security, testing

- **Security:** all access is PocketBase collection rules (no keys). Only published levels are
  listable; only the author can edit/delete their level; one rating per user per level (unique
  index). `title`/`author_name` rendered with `textContent` (never innerHTML — XSS-safe, matches
  the leaderboard). `data` is validated by `validateLevel` before ever building a `Sim`, so a
  malicious blob can't inject parts that don't exist (unknown type → rejected).
- **Local-first / resilience:** editor + Test fully work offline. Publish/Browse show a friendly
  "sign in / connection needed" state when the backend is down; never block the rest of the game.
  Every cloud call is try/wrapped (matches Phase-2 cloud.js).
- **Abuse bounds:** title ≤60, author_name ≤40, `data` size sanity-checked client-side before
  publish (reject absurdly large blobs). PB rate-limiting (Settings) as the backstop.
- **Testing:**
  - Pure `?test` (`editor.test.js`): editor working-state → valid level JSON; the
    publish-gating predicate (can't publish unsolved/invalid); thumbnail draw is pure-enough to
    smoke-test its geometry; cloud shaping helpers (level record ↔ display).
  - **Physics:** any level the editor produces in Test must be runnable by `Sim`; the headless
    solvability harness is reused to confirm a sample editor-built level solves.
  - **Real-browser QA (Playwright):** build a level in the editor → Test → solve → (signed-in)
    Publish → it appears in Browse → open it → play → like it; 0 console/page errors; across
    themes. Backend-live verification after deploy, then clean up test data (as in Phase 2).

## Out of scope (this spec)

- The three polish items (per-theme sprites, sprite animation, sound) — separate polish spec.
- Editor undo/redo history (nice-to-have; the draft autosave + Clear is enough for v1).
- Level remix/fork, comments, moderation queue.
