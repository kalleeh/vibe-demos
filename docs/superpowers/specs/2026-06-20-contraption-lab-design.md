# Contraption Lab — design

**Date:** 2026-06-20
**Slug:** `contraption-lab` · **Title:** Contraption Lab
**Type:** tier-1 demo in vibe-demos (static frontend + optional PocketBase backend)
**Live URL (on ship):** https://kalleeh.github.io/vibe-demos/contraption-lab/

## Summary

A modern, browser- and iPad-friendly clone of *The Incredible Machine* (1990s Rube
Goldberg physics puzzler). The player is given a goal, a fixed starting scene, and a
limited inventory of parts; they place parts, press **Run**, and watch a 2D physics
simulation play out until the goal is met. Built on Matter.js, themeable, and shipped in
three vertical-slice phases. PocketBase backs accounts, progress, and a community level
editor — but the game is fully playable with no backend (local-first).

## Decisions locked during brainstorming

- **Engine:** Matter.js, vendored as a single static JS file. No build tool, no
  package.json, no runtime CDN (respects vibe-demos rules: push to `main` = deploy).
- **Scope (Approach A — vertical slices):** ship the playable core first, grow the
  backend only when there is real shared state. Phases below.
- **Art:** themeable via CSS custom-property token sets. Default **Workshop Blueprint**
  (kin to `resonans`/`tinywings`); also Cartoon, Neon, Clean Toy. Theme swaps without
  touching game logic — game code references tokens, never colors.
- **Level data format:** designed up front (Section 3) so the editor, official levels,
  and PocketBase all share one versioned contract.
- **Local-first:** every feature works with no backend; PocketBase enhances, never gates
  (tinywings pattern).

## Phases (each is its own commit, follows the maintenance contract)

- **Phase 1 — playable core:** sandbox + ~8–12 hand-made official levels. Matter.js
  engine, ~10-part palette, drag-place/rotate/delete on a snap grid, Run/Reset, win
  detection, theming, PWA shell. Progress in localStorage. A complete, satisfying demo on
  its own. **This is the first ship** (added to works index + README).
- **Phase 2 — accounts + progress/leaderboard:** PocketBase email/password auth;
  `progress` collection synced local-first; per-level leaderboards (fewest parts, then
  fastest time).
- **Phase 3 — community editor:** in-game level editor (build → test → publish); `level`
  + `rating` collections; browse screen (recent / most-played / top-rated); play
  community levels.

## Section 1 — Architecture & file layout

Single self-contained demo folder, plain static files, no bundler. JS is split into ES
modules loaded via `<script type="module">` so each file stays focused (still static).

```
contraption-lab/
├── index.html              ← shell, theme <select>, canvas, palette UI, PWA wiring
├── style.css               ← layout + theme token sets (CSS custom properties)
├── icon.svg, manifest.webmanifest, sw.js   ← PWA shell (cribbed from tinywings)
├── vendor/matter.min.js    ← pinned Matter.js, vendored (no CDN at runtime)
├── js/
│   ├── main.js             ← boot, hash routing (menu → play → editor → browse)
│   ├── engine.js           ← Matter.js setup, run/reset, win-detection loop
│   ├── parts.js            ← part registry: type → Matter body factory + render hints
│   ├── render.js           ← themed canvas drawing of bodies + grid (reads CSS tokens)
│   ├── input.js            ← pointer/touch: drag-place, drag-move, rotate, delete
│   ├── level.js            ← level schema: load / serialize / validate
│   ├── levels/official.js  ← the ~8–12 official levels (as level JSON)
│   ├── progress.js         ← localStorage progress + (Phase 2) PocketBase sync
│   ├── editor.js           ← (Phase 3) build/test/publish a level
│   ├── theme.js            ← apply/persist theme choice
│   └── level.test.js       ← pure-logic assertions, run via ?test query param
└── pb/pb_migrations/       ← (Phase 2/3) PocketBase collections, NNN_*.js
```

Screen routing is hash-based (`#/`, `#/play/<levelId>`, `#/editor`, `#/browse`) — no
router library.

## Section 2 — Simulation & gameplay loop (Phase 1)

**Loop:** load level → see fixed scene + goal → drag parts from palette → **Run** →
Matter.js simulates → win-detector checks each tick → win banner or **Reset** to tweak.

**Two body classes:**
- **Fixed/scenery** (from the level): walls, the goal target, pre-placed objects. Not
  movable by the player.
- **Player parts** (from a per-level inventory with limited counts): placed during build,
  frozen until Run.

**Build vs Run states.** In *build*, bodies are `isStatic` and draggable on a snap grid;
rotation via a handle or two-finger twist. In *run*, the world steps live. **Reset
restores the exact pre-run placement from a build-state snapshot** — never trust
post-sim positions.

**Win detection.** Each level declares a goal predicate. Phase 1 supports `dwell`: a
dynamic body tagged `goal-object` overlaps the `goal-zone` sensor for ≥ N ms (collision
sensor + dwell timer, to avoid false positives from a body grazing through).

**Phase-1 part set (~10):** ball, balloon (buoyant/rises), wooden plank/ramp, wall block,
seesaw (pivot constraint), fan (force in a cone), conveyor belt (surface velocity),
bucket/basket, domino, goal target. Adding a part later = one registry entry in
`parts.js`; the level format does not change.

**iOS/iPad first:** pointer events (not mouse); `touch-action: none` on the canvas; no
hover-dependent UI; large tap targets; fixed viewport, no rubber-band scroll; verified in
Safari responsive mode.

## Section 3 — Level data format (versioned contract)

One JSON object per level. Produced by the editor, authored for official levels, stored
in PocketBase (`level.data`), and loaded by the player. Fixed now.

```js
{
  "schema": 1,                       // bump on breaking changes
  "id": "official-03",               // slug or PB record id
  "title": "Wake the Cat",
  "author": "official",              // or a PB user id / display name
  "world": { "w": 1280, "h": 720, "gravity": 1 },
  "goal": {                          // Phase 1 supports type:"dwell"
    "type": "dwell",
    "object": "ball",                // tag of the body that must arrive
    "zone": { "x": 1100, "y": 600, "w": 120, "h": 120 },
    "ms": 500
  },
  "fixed":   [ /* scenery: {type,x,y,angle,props,tag?}, not movable */ ],
  "start":   [ /* pre-placed dynamic bodies, e.g. the ball */ ],
  "inventory": [ { "type": "ramp", "count": 2 }, { "type": "fan", "count": 1 } ],
  "par":     { "parts": 3 }          // optional: for "solved in N parts" scoring
}
```

- **One part registry** maps `type` → Matter body factory + render hints. The format is
  stable across part additions.
- **Versioned** via `schema`: unknown future `schema` or part `type` fails gracefully
  with a "needs a newer version" card rather than crashing.
- **Fixed 1280×720 world space**, scaled to fit the device — a level authored on desktop
  plays identically on an iPhone.
- This same blob is the PocketBase `level.data` JSON field in Phase 3.

## Section 4 — Backend (Phase 2 + 3) & local-first contract

The game is fully playable with **no backend**. PocketBase only enhances. Follows the
tinywings pattern. **Before writing any backend file, query Context7 for current
PocketBase migration/JSVM/SDK syntax** (per vibe-demos CLAUDE.md) — Context7 wins over any
snippet here.

**Phase 2 — accounts + progress/leaderboard**
- Auth: PocketBase built-in `users` email/password collection. Anonymous play always
  works; signing in syncs.
- `progress` collection: `{ user (relation), level_id (text), solved (bool),
  best_parts (number), best_ms (number) }`. Writes hit localStorage immediately; if
  signed in + backend healthy, mirror to PB. On load, merge best-of local and remote.
- Per-official-level leaderboard view: fewest parts, then fastest time.

**Phase 3 — community levels**
- `level` collection: `{ author (relation), title (text), data (json — Section 3 blob),
  plays (number), likes (number), published (bool) }`.
- `rating` collection: `{ user, level (relation), value }` — unique per (user, level);
  `likes` is the rollup.
- Rules: `listRule`/`viewRule` = published only; `createRule`/`updateRule` = author-owned
  (`@request.auth.id = author`). Play-count increment via a small guarded update / JSVM
  hook.
- Browse screen: recent / most-played / top-rated, paginated.

**Conventions honored:** collections singular snake_case; migrations are source of truth
in `pb/pb_migrations/NNN_*.js` (sequential, never renumbered); new port **8100** in
`backends/config.json` (8091–8099 taken); PB JS SDK pinned to a recent exact version
(never `@latest`); `sw.js` skips cross-origin caching; subtle online/offline indicator.

## Section 5 — Theming, error handling, testing

**Theming.** Visual values are CSS custom properties on `:root` (`--bg`, `--ink`,
`--part-fill`, `--part-stroke`, `--grid`, `--accent`, fonts, line-weights). Four token
sets — **Workshop Blueprint** (default), Cartoon, Neon, Clean Toy — selected by a
`data-theme` attribute on `<html>`. `render.js` reads tokens via `getComputedStyle` so the
*canvas* matches the theme, not just the HTML chrome. Choice persisted in localStorage.
Honors `prefers-reduced-motion`. Game logic references tokens only, never colors.

**Error handling / resilience.**
- Backend down/offline → silent localStorage fallback; subtle online/offline dot; never a
  blocking error.
- Level load failure / unknown `schema` or part `type` → graceful "needs a newer version"
  card, not a crash.
- Physics safety: a ~30s max-run timer auto-stops a sim that never wins; bodies leaving
  world bounds are culled.
- Editor publish validates against the schema before sending to PB.

**Testing.** No build tool. Pure logic (level validate/serialize round-trip, progress
best-of merge, goal-predicate evaluation) gets assertion checks in `js/level.test.js`,
run via a `?test` query param that logs pass/fail to console. Physics/visual behavior is
verified manually in-browser (desktop + iPad viewport) each phase. Each phase ends green
on works-index/README sync (`check-portal`) and a manual play-through.

## Maintenance-contract checklist (per shipping phase)

1. `contraption-lab/index.html` is the demo entry point (kebab-case slug).
2. Root `index.html` works index gets a `<a class="work">` row at the next chronological
   number; update `<div class="count">Index / NN entries</div>`.
3. Add a 1280×720 thumbnail (`thumbs/contraption-lab.jpg`) or reuse an internal hero asset
   (and add its path to root `sw.js` allow-list).
4. Mirror the entry into `README.md`.
5. Phase 2/3 only: add `"contraption-lab": { "port": 8100 }` to `backends/config.json` and
   run `./sync-backends.sh`.
6. If the pitch is queued in `IDEAS.md`, mark it `🟢 shipped`.
