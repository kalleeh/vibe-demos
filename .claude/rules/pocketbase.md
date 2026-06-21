---
paths:
  - "*/pb/**"
  - "backends/**"
  - "sync-backends.sh"
---

# PocketBase backend pattern (optional persistence/sync layer)

PocketBase is the backend for vibe-demos that need shared/persistent state. Local-first: every demo MUST work without it. The backend enhances — it never gates.

Reference implementation: `tinywings/` — canonical PocketBase demo (Tier 1 public leaderboard, local-first fallback, fetch-on-open refresh, anonymous `player_id` identity, XSS-safe `textContent` rendering, graceful offline degradation). Its leaderboard logic lives in its own `<script type="module">`, bridged to the classic game script via a `window.__lbOnEnd` hook.

> **ALWAYS check Context7 for current PocketBase docs before any backend work.** PocketBase ships breaking changes frequently (schema API, migration helpers, JSVM hooks, SDK methods churn across minor versions), so snippets here WILL drift. Before writing a migration, a JSVM hook, or SDK frontend code, query Context7 to confirm current syntax — if it contradicts this file, Context7 wins, and update this file in the same commit.
> - `/websites/pocketbase_io_jsvm` — JSVM (migrations, hooks, cron) — needed most for backend files
> - `/pocketbase/js-sdk` — official JS SDK (frontend fetch/auth/upload)
> - `/websites/pocketbase_io` — main docs · `/pocketbase/pocketbase` — Go core (latest version tags)

## Decision tree

```
Does the demo need data that persists across browser clears
OR is shared between multiple users?
  ├─ NO  → client-only (localStorage/IndexedDB). Stop here.
  └─ YES → Does <slug>/pb/ exist?
              ├─ YES → backend exists. URL: https://<slug>.pb.gurum.se  (port in backends/config.json)
              └─ NO  → create it (see checklist).
```

Use PocketBase for: multiplayer/shared state, persistent leaderboards (survive browser clear, shared across visitors), cross-device sync. Stay client-only for: single-user/single-device, data-loss-on-clear acceptable, no shared state.

## Checklist: adding a backend

1. **`<slug>/pb/pb_migrations/001_<description>.js`** — migration defining collections.
2. **`backends/config.json`** — add `"<slug>": { "port": <next port> }` (ports start 8091, never reused, always increment).
3. **`<slug>/index.html`** — add `"pocketbase"` to the importmap; `const PB_URL = 'https://<slug>.pb.gurum.se';`; health check + localStorage fallback; collection schema comment block atop the module script; a subtle online/offline indicator.
4. **`<slug>/sw.js`** — skip cross-origin fetches from caching.
5. **Run `./sync-backends.sh`** from the repo root to deploy.

## Conventions

- **Collection names:** singular, snake_case (`leaderboard`, `game_state`, `player_move`).
- **Migration naming:** `NNN_<description>.js` — sequential, never renumbered.
- **Migrations are the source of truth.** Admin UI edits are prototyping only — snapshot back to files with `ssh pb-backends "cd /opt/pocketbase/<slug> && ./pocketbase migrate collections"` before committing.
- **Ports:** always increment from 8091, never reuse.
- **SDK version: pin exactly, never `@latest`** — but pin a *recent* version. Query Context7 (`/pocketbase/js-sdk` for SDK tag, `/pocketbase/pocketbase` for core) for current latest, then pin that.
  - **State (verified 2026-06-08, re-verify via Context7):** server binary `/opt/pocketbase/pocketbase` is `0.25.8`; the 7 existing backends pin SDK `0.25.0`. SDK `0.25.x`/`0.26.x` talk to a `0.25.8` server fine. Core has reached `0.35.x`.
  - **Bumping the server binary affects ALL deployed backends at once** (single shared binary) — treat as a coordinated migration: read release notes for breaking changes, test against a non-critical backend first, bump SDK pins to match. Don't bump casually mid-feature.
  - New isolated backend: pin the latest verified SDK; keep it ≥ the server's major.minor.

## SDK import

```html
<script type="importmap">
  { "imports": { "pocketbase": "https://cdn.jsdelivr.net/npm/pocketbase@0.26.2/dist/pocketbase.es.mjs" } }
</script>
```

(`0.26.2` was latest verified via Context7 on 2026-06-08 — re-check and pin current when adding a backend. The 7 pre-existing demos still pin `0.25.0`; leave them unless deliberately upgrading + re-testing.) One importmap per page — combine with three/three-addons if needed. If the demo has no module script yet (classic-`<script>` game like tinywings), add the importmap and put PB logic in its own `<script type="module">`, talking to the classic script via a `window.__*` hook. With no browser, sanity-check a module body with `node --check`.

## Security tiers (collection API rules, NOT API keys)

An API key in a public frontend is security theater; rules are the real access control. Tiers are composable.

**Tier 1 — Public data (default for most demos):**
```
listRule: ""   viewRule: ""   createRule: ""   updateRule: null   deleteRule: null
```
No auth. Abuse prevention: field validation (max lengths, min/max) + PocketBase rate limiting (Settings → Application).

**Tier 2 — Anonymous identity (multiplayer):**
```js
let playerId = localStorage.getItem('vibe.<slug>.player-id');
if (!playerId) { playerId = crypto.randomUUID(); localStorage.setItem('vibe.<slug>.player-id', playerId); }
```
```
updateRule: "player_id = @request.body.player_id"   ← own data only
```

**Tier 3 — Real accounts (rare — only for cross-device identity):**
```js
await pb.collection('users').authWithPassword(email, password); // token auto-persisted + attached
```
```
listRule: "owner = @request.auth.id"   ← own data only
```

## Local-first fallback

```js
import PocketBase from 'pocketbase';
const PB_URL = 'https://<slug>.pb.gurum.se';
const pb = new PocketBase(PB_URL);
let online = false;
try { await pb.health.check(); online = true; } catch { online = false; }

async function getScores() {
  if (online) {
    try { return await pb.collection('leaderboard').getFullList({ sort: '-score' }); }
    catch { online = false; }
  }
  return JSON.parse(localStorage.getItem('vibe.<slug>.scores') || '[]');
}
```

Show a subtle indicator (`● connected` / `○ local`). Never block the UI. Do NOT poll to reconnect — check `pb.health.check()` only on user-initiated actions.

## Realtime subscriptions

```js
pb.collection('game_state').subscribe('*', (e) => { updateUI(e.record); }); // e.action: create|update|delete
```
SDK auto-reconnects on disconnect; listen for `pb.realtime.onDisconnect` only if the demo needs to handle it.

## Service worker

Skip all cross-origin fetches from caching:
```js
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // ... normal cache strategy
});
```

## Collection schema comment (top of module script)

```js
/*
 * PocketBase: https://<slug>.pb.gurum.se/_/
 * Collection: leaderboard (base)
 *   - name (text, required, max: 20)
 *   - score (number, required, min: 0)
 *   - player_id (text)
 *   Rules: list="", view="", create="", update=null, delete=null
 */
```

## Migration file format

```js
// <slug>/pb/pb_migrations/001_init_leaderboard.js
migrate((app) => {
  let collection = new Collection({
    type: "base", name: "leaderboard",
    listRule: "", viewRule: "", createRule: "", updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 20 },
      { type: "number", name: "score", required: true, min: 0 },
      { type: "text", name: "player_id" },
      // PB 0.25 base collections do NOT auto-create created/updated.
      // Declare them as autodate or any `sort=created` 400s. See anti-patterns.
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("leaderboard");
  app.delete(collection);
});
```

## Deploy

`sync-backends.sh` is the single deploy command. It reads `backends/config.json`, rsyncs `<slug>/pb/pb_migrations/` **and `<slug>/pb/pb_hooks/`** (if present), provisions systemd units, regenerates the Caddyfile. Idempotent.

```bash
./sync-backends.sh    # run from the vibe-demos repo root
```

**JS hooks (custom routes / `routerAdd`) — gotchas from building the `ai` proxy:**
- Hook files at `<slug>/pb/pb_hooks/*.pb.js`. Auto-loaded from `pb_hooks/` next to the instance working dir — no `--hooksDir` flag. `sync-backends.sh` rsyncs them.
- **Handler scope is ISOLATED.** A `routerAdd(...)` handler CANNOT see file-scope `const`/`function` declarations — referencing one throws `ReferenceError` at request time (surfaces as a generic `400 {"data":{},"message":"Something went wrong"}`). Define every helper + constant INSIDE each handler.
- **Cross-call state** (rate-limit windows, used-nonce sets) can't live in a module-level `Map` (scoping + not concurrency-safe). Use `$app.store().get(k)` / `.set(k, v)`.
- **Read a JSON body** with `e.requestInfo().body` (parsed map). `e.bindBody({})` into a plain object does NOT populate it.
- **Return** with `e.json(status, obj)`. **Call out** with `$http.send({method,url,headers,body,timeout})` → `res.statusCode` + `res.json`. Env via `$os.getenv(name)`; crypto via `$security.sha256/hs256/randomString/equal`.
- **Secrets** (API tokens, signing secrets) go in a **0600 systemd drop-in** `/etc/systemd/system/pocketbase@<slug>.service.d/env.conf` (`Environment=FOO=...`), set out-of-band on the server — NEVER in the repo, NOT written by `sync-backends.sh` (which only writes `port.conf`). Hook reads them via `$os.getenv`. Reference: `ai/pb/pb_hooks/proxy.pb.js` (Bedrock proxy: bearer-token auth + proof-of-work anti-spam gate).

**Infrastructure** (the deploy script handles all of this; rarely touched):
- Server: Lightsail `pb-backends` (13.61.133.93), 2GB RAM, eu-north-1.
- Caddy reverse proxy, wildcard TLS (Let's Encrypt DNS-01 via Route 53).
- Each backend: systemd unit `pocketbase@<slug>`, port from config.json.
- SSH: `ssh pb-backends`. Rebuildable: re-provision + run sync = full recovery.

## Anti-patterns

- Do NOT make PocketBase required for the demo to load — always fall back to local data.
- Do NOT use a BYO-URL pattern — we own the server; bake the URL in as a constant.
- Do NOT add user login unless the demo needs cross-device identity — Tier 1 or 2 for most.
- Do NOT use `innerHTML` with user-submitted fields — use `textContent` (XSS).
- Do NOT assume collections exist without a migration file (migrations are the source of truth).
- Do NOT assume `created`/`updated` exist — PB 0.25 base collections don't auto-create them. If the frontend sorts/filters on `created`, declare it as `autodate` or `getFullList({ sort: 'created' })` 400s. (tinywings dodges this by sorting `-score`; the six demos in `cbbf5f5` needed a `002_add_autodate.js` follow-up.)
- Do NOT use PocketBase for static data that could be a JSON file.
- Do NOT run PocketBase on GitHub Pages (it's a server binary).
- Do NOT add `pocketbase` to a package.json — CDN import only.
- Do NOT rely on API keys in the frontend — collection rules are the access control.
- Do NOT implement reconnection polling — check health on user actions only.
