# Tinywings shared leaderboard — design

**Date:** 2026-06-01
**Demo:** `tinywings/` ("Sketchwings")
**Goal:** Add a shared, persistent distance leaderboard backed by PocketBase, following the repo's PocketBase pattern (Tier 1 public, local-first, fetch-on-open).

## Summary

Tinywings already tracks a personal best distance (`G.bestDist`, persisted to
`localStorage["vibe.tinywings.best"]`) and shows a "— a new best —" line on the
day-ends end panel. This adds a global leaderboard so players' personal bests
are ranked against everyone else's.

The demo MUST remain fully playable with the backend down — the leaderboard is
an enhancement layer, never a gate. This follows CLAUDE.md's PocketBase pattern,
and tinywings becomes the canonical reference implementation named there.

## Metric

Distance in metres (integer). The leaderboard stores each submitting player's
best submitted distance. We rank by `score` descending.

## Backend (PocketBase, Tier 1 — public)

### Collection: `leaderboard` (base)

| field       | type   | constraints           |
|-------------|--------|-----------------------|
| `name`      | text   | required, max 20      |
| `score`     | number | required, min 0       |
| `player_id` | text   | (no constraint)       |

Rules: `listRule=""`, `viewRule=""`, `createRule=""`, `updateRule=null`,
`deleteRule=null`. Anyone reads, anyone creates, nobody edits/deletes.

`player_id` is an anonymous `crypto.randomUUID()` kept in
`localStorage["vibe.tinywings.player-id"]`. It is NOT an access-control
mechanism (rules are Tier 1); it is used only client-side to highlight the
player's own rows ("you") in the overlay.

Abuse posture: this is a demo. Field validation (name max 20, score min 0) plus
PocketBase's built-in rate limiting is sufficient. No auth.

### Files to create / modify for the backend

1. **`tinywings/pb/pb_migrations/001_init_leaderboard.js`** — new. Defines the
   `leaderboard` collection per the migration-file format in CLAUDE.md, with a
   down-migration that deletes the collection.
2. **`backends/config.json`** — add `"tinywings": { "port": 8091 }` to the
   `"backends"` object (8091 is the first port; ports increment, never reused).
3. **Deploy** — the human runs `./sync-backends.sh`. The agent does NOT run it.
   URL after deploy: `https://tinywings.pb.gurum.se`.

## Frontend changes (all in `tinywings/index.html`)

The main game logic is a classic `<script>` using a global `G` state object.
The PocketBase integration lives in its own `<script type="module">` (for the
ESM import) and communicates with the game via the global `G` state and DOM.

### 1. Importmap + constants

Add a one-entry importmap in `<head>`:

```html
<script type="importmap">
  { "imports": { "pocketbase": "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs" } }
</script>
```

In the leaderboard module:

```js
const PB_URL = 'https://tinywings.pb.gurum.se';
const pb = new PocketBase(PB_URL);
let online = false;
```

A collection-schema comment block documents the `leaderboard` collection at the
top of the module (per CLAUDE.md convention).

### 2. Identity + remembered name

- `vibe.tinywings.player-id` — `crypto.randomUUID()`, created once.
- `vibe.tinywings.name` — last name the player submitted; pre-fills the field.

### 3. Health check (local-first)

On module load: `try { await pb.health.check(); online = true } catch { online = false }`.
Re-check (best-effort) when a submit or fetch throws. No reconnection polling.

### 4. Submit flow — prompt on new personal best

The end panel (`#endPanel`) already computes `newBest`. Add a hidden submit
block inside the end panel, below the existing `#endNewBest` line:

- Shown only when `newBest === true` AND `online === true`.
- Contains: a text input (`maxlength=20`, pre-filled from `vibe.tinywings.name`,
  placeholder e.g. "your name"), and a "submit to leaderboard" button.
- The score submitted is the just-finished run's distance (`G.bestDist` / the
  run's `distM`); not user-editable.
- On submit: create the record, remember the name, swap the block for a small
  "submitted ✓ — you're #N" confirmation (rank computed from a fetch), and the
  leaderboard overlay's cached list is invalidated so it refetches on next open.
- On failure (network/401-equiv): set `online=false`, show a brief "couldn't
  reach the leaderboard" note; the run is unaffected.
- When offline, the submit block stays hidden — the existing "— a new best —"
  line still shows (personal best is local-first and unchanged).

### 5. Leaderboard overlay — display, fetch-on-open

- A topbar text link `leaderboard` placed immediately before the `← Studio`
  link in `<header class="topbar">`, styled to match the `.back` link grammar.
- Clicking opens a full-screen overlay in the pencil/cream aesthetic
  (consistent with `.end-panel` / `.intro-panel`): title, a connection
  indicator (`● connected` / `○ local`), a scrollable list of the top ~25 rows
  (`getFullList({ sort: '-score' })`, sliced/limited to 25), and a close button.
- Each row: rank, name, distance. The player's own rows (matched by
  `player_id`) are highlighted ("you").
- Rendering uses `textContent` only — never `innerHTML` with PB fields (XSS).
- **Fetch-on-open only**: fetch when the overlay opens and once after a
  successful submit. No realtime subscription.
- When offline: the overlay still opens but shows "○ local — leaderboard
  unavailable" instead of the list.

### 6. Loading state

Per the "Loading states" rule: while fetching, show visible motion matching the
demo's aesthetic — a thin pencil-stroke shimmer / animated placeholder rows in
the overlay, honoring `prefers-reduced-motion`. No generic spinner, no static
"Loading…".

### 7. Service worker (`tinywings/sw.js`)

- Add a guard so cross-origin requests are not cached (so
  `tinywings.pb.gurum.se` and the cdn.jsdelivr PB ESM are never served stale):
  `if (new URL(e.request.url).origin !== self.location.origin) return;`
- Bump the cache name `vibe-tinywings-v1` → `vibe-tinywings-v2`.

## Data flow

```
game over → newBest computed (existing)
  └─ online & newBest → reveal submit block on #endPanel
       └─ user submits → pb.collection('leaderboard').create({name, score, player_id})
            └─ remember name, show "#N" confirm, invalidate overlay cache

topbar "leaderboard" → open overlay
  └─ online → getFullList({sort:'-score'}) → render top 25, highlight own rows
  └─ offline → "○ local — leaderboard unavailable"
```

## Error handling

- All PB calls wrapped in try/catch; any failure flips `online=false` and
  degrades to local-only behavior. The game loop never awaits PB.
- 20-char name cap enforced both client-side (`maxlength`) and by the collection
  rule (`max: 20`).
- Empty name on submit → fall back to a default (e.g. "anon") rather than
  blocking; trimmed before send.

## Out of scope (YAGNI)

- Realtime subscriptions.
- User accounts / cross-device identity.
- Editing or deleting submitted scores.
- Per-day or per-palette leaderboards (single global distance board only).
- Anti-cheat beyond field validation.

## Maintenance contract

This is an in-place enhancement of an already-shipped demo. The works index in
root `index.html`, `README.md`, and the thumbnail are unchanged — no add/remove/
rename, so the three-way sync does not apply.

## Testing / verification

- Migration parses (review against CLAUDE.md format; human deploy via
  `./sync-backends.sh` then check `https://tinywings.pb.gurum.se/_/`).
- Frontend: load with backend reachable → submit a best → see it in overlay,
  highlighted. Load with backend unreachable (offline) → game plays normally,
  overlay shows local-unavailable note, no console errors blocking the loop.
- Existing playtest driver (`project_tinywings_playtest_driver`) can drive a run
  to game-over to exercise the submit path.
- After deploy: `curl -s -o /dev/null -w "%{http_code}\n"` the Pages URL (200)
  and confirm overlay/connection indicator behaves.
```
