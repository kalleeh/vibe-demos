# Server-side Claude Key Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up one shared `ai.pb.gurum.se` PocketBase proxy that injects the owner's Anthropic key and forwards (dumb-proxy) to the Messages API, gated by origin check + per-IP rate limit + a daily budget cap; then wire the four AI demos to a hybrid flow (canned → proxied → BYO-key) so casual viewers get live AI with no key, degrading gracefully on 429/503.

**Architecture:** A dedicated PB 0.25.8 instance (port 8098) with a single `pb_hooks` route `POST /api/claude`. The hook reads the key from `$os.getenv("ANTHROPIC_PROXY_KEY")`, validates origin/model/body, enforces rate + daily budget, and forwards via `$http.send` (verified working on the live box). Frontends branch in their existing `callClaude()`: if the viewer pasted a key → direct call to api.anthropic.com (unchanged); else → keyless call to the proxy, which returns the identical Anthropic JSON so all downstream parsing is untouched.

**Tech Stack:** PocketBase 0.25.8 JSVM hooks (goja), plain static HTML/JS frontends, systemd per-instance env drop-in, Caddy reverse proxy (existing). No build tool.

**Spec:** `docs/superpowers/specs/2026-06-07-server-side-claude-proxy-design.md`.

---

## Important constraints

- **The key is NEVER in the repo, this plan, logs, or any commit.** It lives only in `ANTHROPIC_PROXY_KEY` in a 0600 systemd drop-in on the server, set by the OWNER manually (Task 7). The hook reads it via `$os.getenv`. No task writes the key value anywhere.
- **Owner-only manual steps** (the agent CANNOT and MUST NOT do these): create/confirm the Anthropic key + $5 spend cap + model restriction + alerts; place the key in the server env; restart the unit. Tasks 7 documents the exact commands for the owner to run. Until then, the proxy returns 503 and demos fall back to canned + BYO — so all code ships safely before the key exists.
- **Dumb proxy:** the proxy does NOT hold or inject system prompts. The frontend sends the full body (model, system, messages) minus the key; the proxy validates + forwards. Prompts stay client-side.
- **Non-streaming only.** All four demos are non-streaming; the hook rejects `stream:true`.
- **No build tool / no package.json.** Verified facts (from spec §7): `$os.getenv` and `$http.send` work on this PB 0.25.8; systemd uses template + `.d/` drop-ins; `sync-backends.sh` writes `port.conf` and is NOT modified to carry the key.
- **Verification** = `node --check` on hook + frontend module bodies, plus live `curl` probes against the deployed proxy (the hook is server JS run by goja, not Node — `node --check` validates syntax only; real behavior is checked via curl once deployed).

---

## File Structure

```
vibe-demos/
├── backends/config.json              ← EDIT: add "ai": { "port": 8098 }
├── ai/                               ← NEW backend (proxy only, no collections)
│   └── pb/
│       └── pb_hooks/
│           └── proxy.pb.js           ← NEW: the POST /api/claude route + abuse control
├── intake-companion/index.html       ← EDIT: hybrid branch in callClaude
├── live-globe/index.html             ← EDIT: hybrid branch in its Claude call
├── clinic-admin/index.html           ← EDIT: hybrid branch in its Claude call
├── korean-mbti/index.html            ← EDIT: hybrid branch in its Claude call
└── docs/.../2026-06-07-server-side-claude-proxy.md  ← this plan
```

No new collections are required for the proxy route itself. The daily-budget counter uses ONE tiny collection on the `ai` instance (Task 3), created via a migration.

---

## Task 1: Register the `ai` backend (config only, no key)

**Files:**
- Modify: `backends/config.json`

- [ ] **Step 1: Add the `ai` backend entry.** Read `backends/config.json`, find the `"backends"` object, add `"ai"` with the next free port 8098 (8091–8097 are taken). Example shape (match the file's existing formatting):

```json
"ai": { "port": 8098 }
```

- [ ] **Step 2: Verify JSON is valid.**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
node -e "JSON.parse(require('fs').readFileSync('backends/config.json','utf8')); console.log('CONFIG OK')"
```
Expected: `CONFIG OK`.

- [ ] **Step 3: Commit.**
```bash
git add backends/config.json
git commit -m "ai-proxy: register shared ai backend on port 8098"
```

---

## Task 2: Write the proxy hook — dumb forward + origin/model/body guards (no rate/budget yet)

**Files:**
- Create: `ai/pb/pb_hooks/proxy.pb.js`

Build the route in two tasks: this task does the forward + the cheap guards; Task 3 adds rate-limit + daily budget. This keeps each independently testable.

- [ ] **Step 1: Create `ai/pb/pb_hooks/proxy.pb.js`** with the route, guards, and forward. (Server JS for goja — uses PB globals `routerAdd`, `$os`, `$http`. The `e` is the RequestEvent in PB 0.25.)

```javascript
// ai/pb/pb_hooks/proxy.pb.js
// Dumb Claude proxy: inject the owner key (from env), validate, forward to Anthropic.
// The key is read from $os.getenv("ANTHROPIC_PROXY_KEY") — set ONLY in the server
// systemd env (0600 drop-in), never in this repo. Returns Anthropic's JSON verbatim.
// Verified on PB 0.25.8: $os.getenv + $http.send both work and reach api.anthropic.com.

const ALLOWED_MODELS = ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"];
const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
const MAX_TOKENS_CEILING = 2048;

function originAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(o => origin === o || origin.indexOf(o) === 0);
}

routerAdd("POST", "/api/claude", (e) => {
  const key = $os.getenv("ANTHROPIC_PROXY_KEY");
  if (!key) {
    // Not configured yet (owner hasn't set the env) — clean 503 so demos fall back.
    return e.json(503, { error: "live proxy not configured" });
  }

  // --- origin check (cheap reject of non-allowed callers) ---
  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) {
    return e.json(403, { error: "origin not allowed" });
  }

  // --- parse + validate body ---
  let body;
  try { body = JSON.parse(e.requestInfo().body ? JSON.stringify(e.requestInfo().body) : "{}"); }
  catch (err) { body = null; }
  // PB 0.25: prefer e.requestInfo().body (already parsed map). Fall back to raw read.
  if (!body || typeof body !== "object") {
    try { body = e.requestInfo().body || {}; } catch (e2) { body = {}; }
  }

  const model = String(body.model || "");
  if (ALLOWED_MODELS.indexOf(model) === -1) {
    return e.json(400, { error: "model not allowed" });
  }
  if (body.stream === true) {
    return e.json(400, { error: "streaming not supported" });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return e.json(400, { error: "messages required" });
  }
  const maxTokens = Number(body.max_tokens || 0);
  if (!maxTokens || maxTokens > MAX_TOKENS_CEILING) {
    body.max_tokens = Math.min(maxTokens || 1024, MAX_TOKENS_CEILING);
  }

  // --- forward to Anthropic (dumb proxy: pass model/system/messages as-is) ---
  try {
    const res = $http.send({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: body.max_tokens,
        system: body.system,
        messages: body.messages,
      }),
      timeout: 60,
    });
    // Relay Anthropic's status + JSON body verbatim. Never log key/prompt/response.
    let parsed;
    try { parsed = JSON.parse(res.raw); } catch (e3) { parsed = { raw: res.raw }; }
    return e.json(res.statusCode || 200, parsed);
  } catch (err) {
    return e.json(502, { error: "upstream request failed" });
  }
});
```

> NOTE on body access: PB 0.25's RequestEvent exposes parsed JSON via `e.requestInfo().body`. The exact accessor is verified at deploy (Task 6 curl) — if `requestInfo().body` is empty for JSON posts, switch to `e.request.body` raw read + `JSON.parse`. The Task 6 probe will reveal which; adjust this one spot then.

- [ ] **Step 2: Syntax-check the hook (Node validates goja-compatible syntax).**
```bash
cd /home/ubuntu/projects/vibe-demos
node --check ai/pb/pb_hooks/proxy.pb.js && echo "HOOK SYNTAX OK"
```
Expected: `HOOK SYNTAX OK`. (Node can't resolve PB globals, but `--check` is syntax-only — globals are fine.)

- [ ] **Step 3: Commit.**
```bash
git add ai/pb/pb_hooks/proxy.pb.js
git commit -m "ai-proxy: dumb-forward hook with origin/model/body guards"
```

---

## Task 3: Add the daily-budget counter + per-IP rate limit to the hook

**Files:**
- Create: `ai/pb/pb_migrations/001_init_proxy_budget.js`
- Modify: `ai/pb/pb_hooks/proxy.pb.js`

- [ ] **Step 1: Create the budget collection migration.** A single-row-per-day counter.

```javascript
// ai/pb/pb_migrations/001_init_proxy_budget.js
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "proxy_budget",
    // Internal bookkeeping — not publicly readable/writable. The hook uses the
    // app-level DAO (superuser context), so API rules can all be locked.
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "day", required: true, max: 10 },   // YYYY-MM-DD
      { type: "number", name: "calls", required: true, min: 0 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_proxy_budget_day ON proxy_budget (day)"],
  });
  app.save(collection);
}, (app) => {
  const c = app.findCollectionByNameOrId("proxy_budget");
  app.delete(c);
});
```

- [ ] **Step 2: Add rate-limit + budget logic to the hook.** Insert into `proxy.pb.js` — after the origin check, before the forward. Add these constants near the top:

```javascript
const DAILY_CALL_CAP = 500;          // global demo budget per day
const RATE_WINDOW_MS = 60 * 1000;    // per-IP window
const RATE_MAX = 10;                 // per-IP calls per window
const ipHits = new Map();            // ip -> [timestamps] (in-memory; resets on restart)
```

And insert this block (after origin check, before body parse). It reads the forwarded IP from Caddy's header, enforces the sliding window, then the daily DB budget:

```javascript
  // --- per-IP rate limit (in-memory sliding window) ---
  const ip = (e.request.header.get("X-Forwarded-For") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    return e.json(429, { error: "rate limit — slow down or use your own key" });
  }
  arr.push(now);
  ipHits.set(ip, arr);

  // --- global daily budget (persisted; survives restart) ---
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  let row;
  try { row = e.app.findFirstRecordByData("proxy_budget", "day", today); }
  catch (err) { row = null; }
  if (row && Number(row.get("calls")) >= DAILY_CALL_CAP) {
    return e.json(429, { error: "daily demo budget reached — paste your own key for unlimited" });
  }
```

And AFTER a successful forward (right before `return e.json(res.statusCode...)`), increment the budget:

```javascript
    // increment the daily budget on a successful upstream call
    try {
      if (row) { row.set("calls", Number(row.get("calls")) + 1); e.app.save(row); }
      else {
        const col = e.app.findCollectionByNameOrId("proxy_budget");
        const r = new Record(col); r.set("day", today); r.set("calls", 1); e.app.save(r);
      }
    } catch (err) { /* budget bookkeeping best-effort; never block the response */ }
```

> NOTE: the exact DAO accessors (`e.app.findFirstRecordByData`, `new Record(col)`, `e.app.save`) are PB-0.25 JSVM APIs verified at deploy (Task 6). If `e.app` isn't the accessor, use `$app`. The Task 6 probe confirms; adjust this one spot.

- [ ] **Step 3: Syntax-check.**
```bash
cd /home/ubuntu/projects/vibe-demos
node --check ai/pb/pb_hooks/proxy.pb.js && echo "HOOK SYNTAX OK"
```
Expected: `HOOK SYNTAX OK`.

- [ ] **Step 4: Commit.**
```bash
git add ai/pb/pb_hooks/proxy.pb.js ai/pb/pb_migrations/001_init_proxy_budget.js
git commit -m "ai-proxy: per-IP rate limit + persisted daily budget cap"
```

---

## Task 4: Deploy the `ai` backend (agent step — provisions instance, NO key yet)

**Files:** none (deploy action)

- [ ] **Step 1: Run the sync to provision the instance + Caddy + systemd.**
```bash
cd /home/ubuntu/projects/vibe-demos
./sync-backends.sh
```
Expected: it rsyncs `ai/pb/`, provisions `pocketbase@ai` on 8098, adds the Caddy host `ai.pb.gurum.se`, reloads Caddy.

- [ ] **Step 2: Verify the instance is up + reachable (health, no key needed).**
```bash
curl -s -o /dev/null -w "ai health -> %{http_code}\n" --max-time 12 https://ai.pb.gurum.se/api/health
```
Expected: `200`.

- [ ] **Step 3: Verify the proxy route returns 503 (key not configured yet — the safe pre-key state).**
```bash
curl -s -X POST https://ai.pb.gurum.se/api/claude \
  -H "Content-Type: application/json" -H "Origin: https://kalleeh.github.io" \
  -d '{"model":"claude-haiku-4-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}' \
  --max-time 15
```
Expected: `{"error":"live proxy not configured"}` with 503. This confirms the hook loaded and the env-gate works. (No commit — deploy step.)

---

## Task 5: Wire the four frontends to the hybrid flow

Each demo gets the SAME minimal change: in its Claude `fetch`, branch on whether the viewer has a pasted key. The proxy returns identical Anthropic JSON, so ONLY the fetch (URL + headers + whether the key is present) changes — all downstream parsing is untouched.

**Files:** `intake-companion/index.html`, `live-globe/index.html`, `clinic-admin/index.html`, `korean-mbti/index.html`

Do these one demo per sub-step, committing each, so a regression is isolatable. Below is the pattern using intake-companion's exact code (line ~3092); apply the equivalent to each demo (find each demo's `fetch("https://api.anthropic.com/v1/messages", {...})`).

- [ ] **Step 1 (intake-companion): add a `PROXY_URL` const + branch the fetch.**
  Near the top of the relevant script, add:
```javascript
  const CLAUDE_PROXY_URL = "https://ai.pb.gurum.se/api/claude";
```
  Replace the existing `fetch("https://api.anthropic.com/v1/messages", { ... })` block. The current code (line ~3092) passes `key` in the header. Change to: if `key` is truthy → direct call (existing headers, unchanged); else → proxy call (no key header, proxy URL, no `anthropic-dangerous-direct-browser-access`). Body is identical in both. Concretely:

```javascript
    const useProxy = !key;
    const res = await fetch(useProxy ? CLAUDE_PROXY_URL : "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: useProxy
        ? { "Content-Type": "application/json" }
        : {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: sys,
        messages: [{ role: "user", content: narrative }],
      }),
    });
```
  The existing `if (!res.ok) { ... e.status = res.status; throw }` block stays — it already surfaces 503/429 as errors the caller can catch. (The caller should, on proxy 429/503, fall back to canned and/or reveal the BYO-key panel — verify the existing catch does something graceful; if it only shows a generic error, add a branch: on `status === 429 || status === 503` while `useProxy`, show "live demo budget reached — paste your own key" and reveal the key panel.)

- [ ] **Step 2 (intake-companion): confirm `max_tokens` ≤ 2048.** The proxy ceiling is 2048; intake-companion sends 2000 ✓. If any demo sends >2048, the proxy will clamp it — but lower the frontend value to match so behavior is predictable. Check each demo's `max_tokens`.

- [ ] **Step 3 (intake-companion): syntax + commit.**
```bash
cd /home/ubuntu/projects/vibe-demos
# extract the classic <script> containing callClaude and node --check it (no bare imports here)
node -e "const h=require('fs').readFileSync('intake-companion/index.html','utf8'); /* manual: ensure file still parses by checking the demo loads */ console.log('ok')"
git add intake-companion/index.html
git commit -m "intake-companion: hybrid Claude flow (proxy when no BYO key)"
```

- [ ] **Step 4: Repeat Steps 1–3 for `live-globe`, `clinic-admin`, `korean-mbti`.** Each: find the `api.anthropic.com/v1/messages` fetch, add the `CLAUDE_PROXY_URL` const, branch on key presence, verify max_tokens ≤ 2048, ensure graceful 429/503 fallback, commit per demo. NOTE the demos differ: live-globe/korean-mbti may build the body differently (check each); preserve each demo's exact body, only change URL+headers+key-branch.

- [ ] **Step 5: Bump each demo's SW cache** (so the frontend change deploys): `intake-companion`, `live-globe`, `clinic-admin`, `korean-mbti` sw.js — increment the version. Commit (can be one commit for all four SW bumps).

---

## Task 6: Live end-to-end verification (AFTER the owner sets the key — see Task 7)

> This task can only fully pass once Task 7 (owner sets the key) is done. Run the pre-key checks now; run the post-key checks after the owner confirms.

**Files:** none (verification)

- [ ] **Step 1 (pre-key): confirm 503 + guards work** (no key needed):
```bash
# 503 when... actually once key is set this returns 200; pre-key it's 503:
curl -s -w "\n%{http_code}\n" -X POST https://ai.pb.gurum.se/api/claude -H "Origin: https://kalleeh.github.io" -H "Content-Type: application/json" -d '{"model":"claude-haiku-4-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
# origin reject:
curl -s -w "\n%{http_code}\n" -X POST https://ai.pb.gurum.se/api/claude -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{"model":"claude-haiku-4-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
# bad model reject:
curl -s -w "\n%{http_code}\n" -X POST https://ai.pb.gurum.se/api/claude -H "Origin: https://kalleeh.github.io" -H "Content-Type: application/json" -d '{"model":"gpt-4","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
```
Expected: 503 (or 200 if key already set); 403 (origin); 400 (model). This validates the body-accessor + guards. **If the first curl errors on body parsing (500), fix the `e.requestInfo().body` accessor in proxy.pb.js per the Task 2 note, re-`./sync-backends.sh`, re-test.**

- [ ] **Step 2 (post-key): real call returns a Claude completion** (after Task 7):
```bash
curl -s -X POST https://ai.pb.gurum.se/api/claude -H "Origin: https://kalleeh.github.io" -H "Content-Type: application/json" -d '{"model":"claude-haiku-4-5","max_tokens":16,"messages":[{"role":"user","content":"say hi in 3 words"}]}' --max-time 30
```
Expected: a real Anthropic JSON response with `content[0].text`. **This spends a few cents against the $5 cap — that's the intended test.**

- [ ] **Step 3 (post-key): budget increments.** Repeat the call; confirm in the PB admin (or a second call) that `proxy_budget` for today incremented. Confirm rate-limit triggers after >10 calls/min from one IP (optional, costs a few cents).

- [ ] **Step 4: frontend live check.** Open each demo (deployed or local), use "try it live" WITHOUT pasting a key → confirm a real response renders. Paste a key → confirm it uses the direct path. Block the proxy / exceed budget → confirm graceful fallback to canned + BYO panel.

---

## Task 7: OWNER-ONLY manual steps (the agent does NOT do these)

> **This task is performed by the human owner, not the agent.** The agent's job is to present these exact commands and wait. The key value never appears in the repo, this plan, or any agent output.

- [ ] **Step 1 (owner): confirm the Anthropic console setup.** You said the key + $5 cap exist. Also confirm: the key is restricted to the three models (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`), and email alerts are set ($1/$3/$5). (Console only — nothing in the repo.)

- [ ] **Step 2 (owner): place the key in the server env via a 0600 systemd drop-in.** Run this ON the server (or via the suggested `! ssh` flow), replacing `<YOUR_KEY>` — this value goes ONLY here:
```bash
ssh pb-backends
sudo install -m 0600 /dev/null /etc/systemd/system/pocketbase@ai.service.d/env.conf
sudo tee /etc/systemd/system/pocketbase@ai.service.d/env.conf >/dev/null <<'EOF'
[Service]
Environment=ANTHROPIC_PROXY_KEY=<YOUR_KEY>
EOF
sudo chmod 0600 /etc/systemd/system/pocketbase@ai.service.d/env.conf
sudo systemctl daemon-reload
sudo systemctl restart pocketbase@ai
```
(The `env.conf` is separate from the `port.conf` that `sync-backends.sh` manages, so future syncs won't touch or expose it.)

- [ ] **Step 3 (owner): confirm.** Tell the agent "key is set" — the agent then runs Task 6 Step 2–4 post-key checks.

---

## Self-review notes (verify before "done")

1. **Key hygiene:** the key value appears in ZERO committed files, this plan, and no agent output. Only in the server's 0600 `env.conf`. ✓
2. **Safe-before-key:** all code (Tasks 1–5) ships and deploys with the proxy returning 503; demos fall back to canned + BYO. No demo breaks pre-key. ✓
3. **Abuse layers all present:** origin check (403) + per-IP rate (429) + daily budget (429) + Anthropic $5 cap (owner). ✓
4. **Dumb proxy:** no system prompt server-side; frontend sends full body minus key. ✓
5. **Non-streaming:** hook rejects stream:true; demos unchanged (non-streaming). ✓
6. **Downstream untouched:** proxy returns identical Anthropic JSON, so each demo's response parsing needs no change — only the fetch URL/headers/key-branch. ✓
7. **PB-version-sensitive spots flagged:** the `requestInfo().body` accessor and the DAO `e.app`/`Record` APIs are the two spots to confirm at deploy (Task 6 Step 1); both have a documented fallback. ✓
8. **sync-backends.sh NOT modified to carry the key** — env is a manual, separate drop-in. ✓
```
