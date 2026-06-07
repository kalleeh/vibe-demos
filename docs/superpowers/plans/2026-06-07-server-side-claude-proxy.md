# Server-side Claude Key Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up one shared `ai.pb.gurum.se` PocketBase proxy that injects the owner's Anthropic key and forwards (dumb-proxy) to the Messages API, **hardened so it is not a public wallet drain**: Haiku-only on the proxy path, a dollar-bounded daily budget, per-IP rate limit, origin check, and a **proof-of-work gate** (the frontend solves a hash puzzle per call). Then wire the four AI demos to a hybrid flow (canned → proxied-Haiku → BYO-key-any-model) so casual viewers get live AI with no key, degrading gracefully on 429/503.

**Security posture (why these layers):** the endpoint is reachable by anyone on the internet — PB auth can't gate a public static frontend (any credential is in view-source). So we don't try to authenticate callers; we (a) make each call cheap (Haiku-only → ~10–20× less than Opus), (b) bound the daily dollar loss below the $5/mo cap, (c) make each call *cost the abuser CPU* via proof-of-work (~200ms for a real viewer, expensive at scale). Worst case becomes "a few dollars + demo falls back to BYO," not "blank check." See spec §2.

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

// Haiku-only on the proxy path — Opus/Sonnet are available ONLY via BYO-key
// (the viewer pays). This caps per-call cost ~10-20x so the $5/mo stretches far.
const PROXY_MODEL = "claude-haiku-4-5";
const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
const MAX_TOKENS_CEILING = 1024; // Haiku, short demo outputs

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
  if (model !== PROXY_MODEL) {
    return e.json(400, { error: "proxy path is Haiku-only — use your own key for other models" });
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
// DOLLAR-BOUNDED, not arbitrary: at Haiku rates with max_tokens<=1024, a call is
// well under a cent. 250/day worst-case is a few cents/day → even a fully-abused
// month stays comfortably under the $5 cap. Recompute from current Haiku pricing
// at build time; keep the number such that 30 * (cost-per-call * DAILY_CALL_CAP) << $5.
const DAILY_CALL_CAP = 250;          // global demo budget per day (dollar-sized)
const RATE_WINDOW_MS = 60 * 1000;    // per-IP window
const RATE_MAX = 8;                  // per-IP calls per window
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
git commit -m "ai-proxy: per-IP rate limit + dollar-bounded daily budget cap"
```

---

## Task 3b: Proof-of-work gate — challenge endpoint + verify in hook

**Files:**
- Modify: `ai/pb/pb_hooks/proxy.pb.js`

The frontend must prove it spent CPU before each call. The proxy issues a signed nonce; the client hashes `nonce:counter` until the SHA-256 digest has N leading zero bits, then sends `counter` + `nonce`. The hook verifies in one hash. Server secret is `$os.getenv("PROXY_POW_SECRET")` (set alongside the key in Task 7). Verify the JSVM crypto API at deploy — PB exposes `$security.hs256(...)` for HMAC and the goja runtime has no native SHA-256 over arbitrary strings unless PB provides it; **confirm `$security` helpers in Task 6 Step 1 and adjust** (fallback: use `$security.randomString` for the nonce and `$security.hs256` for both the signature AND as the PoW hash function — i.e. PoW = find counter s.t. `hs256(nonce:counter, secret)` has N leading hex zeros; the frontend mirrors this with Web Crypto HMAC-SHA256 using a PUBLIC per-challenge salt, NOT the secret — see note).

> **Design note (important):** the PoW hash the *client* computes must NOT require the server secret (the client can't have it). Two clean options — pick at build time:
> - **(A) Plain SHA-256 PoW + signed nonce (preferred):** client finds `counter` s.t. `SHA256(nonce + ":" + counter)` has N leading zero bits (Web Crypto `crypto.subtle.digest`, universally available). The server *separately* HMAC-signs the nonce (`sig = hs256(nonce, secret)`) when issuing it and verifies that sig on submit (so nonces can't be forged/replayed), then recomputes the same SHA-256 to check the work. Server needs a SHA-256 over a string — confirm goja/PB provides one (`$security` or a crypto global) in Task 6; if absent, use option B.
> - **(B) HMAC-with-public-salt PoW:** each challenge includes a random PUBLIC `salt`; client finds `counter` s.t. `HMAC-SHA256(salt, nonce:counter)` has N leading zeros (Web Crypto HMAC, also universal). Server verifies with the same public salt. The nonce's *authenticity* is still protected by a separate `hs256(nonce, SECRET)` signature. This avoids needing a bare SHA-256 on the server if only HMAC is exposed.

- [ ] **Step 1: Add the challenge endpoint + PoW constants.** Add near the top of `proxy.pb.js`:

```javascript
const POW_DIFFICULTY = 16;            // leading zero BITS — tune so a phone solves in ~150-300ms
const POW_TTL_MS = 2 * 60 * 1000;     // a challenge is valid 2 minutes
const usedNonces = new Map();         // nonce -> expiry ms (replay guard; in-memory, pruned)

function powSecret() { return $os.getenv("PROXY_POW_SECRET") || ""; }

// Issue a signed challenge. sig binds the nonce + expiry to our secret so it
// can't be forged; the client never sees the secret.
routerAdd("GET", "/api/claude-challenge", (e) => {
  const secret = powSecret();
  if (!secret) return e.json(503, { error: "live proxy not configured" });
  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const nonce = $security.randomString(24);
  const salt  = $security.randomString(16);            // PUBLIC (option B); harmless for option A
  const exp   = String(Date.now() + POW_TTL_MS);
  const sig   = $security.hs256(nonce + ":" + salt + ":" + exp, secret);
  return e.json(200, { nonce, salt, exp, sig, difficulty: POW_DIFFICULTY });
});
```

- [ ] **Step 2: Verify the PoW on `POST /api/claude`.** Insert at the very top of the POST handler (before origin/model/body — cheapest valid-reject after the not-configured check). Reads PoW fields from headers `X-PoW-Nonce`, `X-PoW-Salt`, `X-PoW-Exp`, `X-PoW-Sig`, `X-PoW-Counter`:

```javascript
  // --- proof-of-work gate ---
  const secret = powSecret();
  if (!secret) return e.json(503, { error: "live proxy not configured" });
  const h = e.request.header;
  const pNonce = h.get("X-PoW-Nonce") || "", pSalt = h.get("X-PoW-Salt") || "",
        pExp = h.get("X-PoW-Exp") || "", pSig = h.get("X-PoW-Sig") || "",
        pCounter = h.get("X-PoW-Counter") || "";
  // 1) signature authentic + not expired
  const expectSig = $security.hs256(pNonce + ":" + pSalt + ":" + pExp, secret);
  if (pSig !== expectSig) return e.json(403, { error: "bad challenge" });
  if (!pExp || Date.now() > Number(pExp)) return e.json(403, { error: "challenge expired" });
  // 2) not already spent (replay guard) — prune expired entries cheaply
  const nowp = Date.now();
  for (const [k, v] of usedNonces) { if (v < nowp) usedNonces.delete(k); }
  if (usedNonces.has(pNonce)) return e.json(403, { error: "challenge already used" });
  // 3) the work itself: HMAC(salt, nonce:counter) must have POW_DIFFICULTY leading zero bits
  //    (option B — uses only $security.hs256, no bare SHA-256 needed server-side)
  const digestHex = $security.hs256(pNonce + ":" + pCounter, pSalt); // salt as the (public) key
  if (leadingZeroBits(digestHex) < POW_DIFFICULTY) {
    return e.json(403, { error: "insufficient proof-of-work" });
  }
  usedNonces.set(pNonce, Number(pExp));
```

And add the helper (top of file):

```javascript
// Count leading zero BITS in a hex string.
function leadingZeroBits(hex) {
  let bits = 0;
  for (let i = 0; i < hex.length; i++) {
    const nibble = parseInt(hex[i], 16);
    if (nibble === 0) { bits += 4; continue; }
    if (nibble < 2) bits += 3; else if (nibble < 4) bits += 2; else if (nibble < 8) bits += 1;
    break;
  }
  return bits;
}
```

> The client mirrors step 3 with Web Crypto `HMAC-SHA256(key=salt, msg=nonce:counter)`, incrementing `counter` until the hex digest has `difficulty` leading zero bits (Task 5). `$security.hs256` returns a hex string in PB 0.25 — confirm format in Task 6 and align `leadingZeroBits` (hex) accordingly. If it returns base64, hex-encode or adjust the bit-count.

- [ ] **Step 3: Syntax-check + commit.**
```bash
cd /home/ubuntu/projects/vibe-demos
node --check ai/pb/pb_hooks/proxy.pb.js && echo "HOOK SYNTAX OK"
git add ai/pb/pb_hooks/proxy.pb.js
git commit -m "ai-proxy: proof-of-work gate (signed challenge + HMAC work + replay guard)"
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

## Task 5: Wire the four frontends to the hybrid flow (proxy = Haiku + PoW)

Each demo branches in its Claude call: BYO-key → direct path (any model, unchanged); no key → proxy path (fetch a PoW challenge, solve it, POST to the proxy with Haiku forced + PoW headers). The proxy returns identical Anthropic JSON, so downstream parsing is untouched.

**Files:** `intake-companion/index.html`, `live-globe/index.html`, `clinic-admin/index.html`, `korean-mbti/index.html` (+ each `sw.js`).

- [ ] **Step 1: Add a shared PoW-solver helper to each demo.** Demos are self-contained (no shared JS), so paste this ~25-line helper into each demo's relevant `<script>` once. It fetches a challenge and solves it with Web Crypto HMAC-SHA256 (mirrors the server's option-B verify):

```javascript
  const CLAUDE_PROXY = "https://ai.pb.gurum.se";
  // Fetch a signed challenge and brute-force a counter whose HMAC has `difficulty`
  // leading zero bits. ~150-300ms on a phone. Returns the headers to send, or null.
  async function solveProxyPoW() {
    const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge");
    if (!r.ok) { const e = new Error("challenge"); e.status = r.status; throw e; }
    const { nonce, salt, exp, sig, difficulty } = await r.json();
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey("raw", enc.encode(salt),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const lead = (bytes) => { // leading zero bits of a Uint8Array
      let b = 0; for (const x of bytes) { if (x === 0) { b += 8; continue; }
        let v = x, c = 0; while ((v & 0x80) === 0) { c++; v <<= 1; } b += c; break; } return b;
    };
    for (let counter = 0; ; counter++) {
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", keyMat, enc.encode(nonce + ":" + counter)));
      if (lead(mac) >= difficulty) {
        return { "X-PoW-Nonce": nonce, "X-PoW-Salt": salt, "X-PoW-Exp": exp,
                 "X-PoW-Sig": sig, "X-PoW-Counter": String(counter) };
      }
      if (counter > 5_000_000) throw new Error("pow-timeout"); // safety valve
    }
  }
```

> Server/client hash MUST agree. The server uses `$security.hs256(nonce + ":" + counter, salt)` and counts leading zero bits of its hex output; the client uses HMAC-SHA256(key=salt, msg=`nonce:counter`) over raw bytes. Confirm in Task 6 that `$security.hs256` is HMAC-SHA256 hex with the 2nd arg as key — if its signature differs, align the client (and the server's `leadingZeroBits` hex vs the client's byte count) so both measure the same bits. This is the one cross-environment agreement to verify before trusting the gate.

- [ ] **Step 2 (intake-companion): branch the fetch.** Add `const CLAUDE_PROXY_URL = CLAUDE_PROXY + "/api/claude";` and replace the existing `fetch("https://api.anthropic.com/v1/messages", {...})` (line ~3092). BYO path unchanged; proxy path forces Haiku + attaches PoW headers:

```javascript
    const useProxy = !key;
    let res;
    if (useProxy) {
      const powHeaders = await solveProxyPoW(); // ~200ms; show a "thinking…" state around the whole call
      res = await fetch(CLAUDE_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...powHeaders },
        body: JSON.stringify({
          model: "claude-haiku-4-5",              // proxy is Haiku-only
          max_tokens: 1024,                        // <= proxy ceiling
          system: sys,
          messages: [{ role: "user", content: narrative }],
        }),
      });
    } else {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model, max_tokens: 2000, system: sys, messages: [{ role: "user", content: narrative }] }),
      });
    }
```

  Keep the existing `if (!res.ok) { e.status = res.status; throw }`. Then ensure the CALLER degrades gracefully: on `useProxy && (status === 429 || status === 503)` → show "live demo budget reached — paste your own key for unlimited" and reveal the BYO key panel, falling back to canned. Verify/extend the existing catch to do this.

- [ ] **Step 3 (intake-companion): syntax + commit.**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e "require('fs').readFileSync('intake-companion/index.html','utf8'); console.log('readable')"
git add intake-companion/index.html
git commit -m "intake-companion: hybrid Claude flow — proxy (Haiku+PoW) when no BYO key"
```

- [ ] **Step 4: Repeat Steps 1–3 for `live-globe`, `clinic-admin`, `korean-mbti`.** Each: paste the PoW helper, find the `api.anthropic.com/v1/messages` fetch, branch on key presence (proxy → Haiku + PoW headers; BYO → unchanged, full model), preserve each demo's exact body/system/messages shape (only the model+max_tokens+URL+headers change on the proxy branch), wire graceful 429/503 fallback, commit per demo. Demos differ in how they build the body — preserve each.

- [ ] **Step 5: Show the PoW solve as "thinking", honestly label Haiku.** Around the proxy call, ensure the existing loading state (per CLAUDE.md: visible motion, no static "Loading…") covers the ~200ms solve. Where the demo names the model on a live run, the proxy path should read as Haiku (don't imply Opus). Small per-demo copy check.

- [ ] **Step 6: Bump each demo's SW cache** (`intake-companion`, `live-globe`, `clinic-admin`, `korean-mbti` sw.js — increment version). One commit for all four.

---

## Task 6: Live end-to-end verification (AFTER the owner sets the key — see Task 7)

> This task can only fully pass once Task 7 (owner sets the key) is done. Run the pre-key checks now; run the post-key checks after the owner confirms.

**Files:** none (verification)

- [ ] **Step 0 (probe the JSVM crypto + body API — do this FIRST, before trusting the PoW math).** Drop a throwaway probe hook on the deployed `ai` instance (or a /tmp test instance like the spec's §7 verification) exposing the values we depend on, then curl it:
  - `typeof $security`, `typeof $security.hs256`, `typeof $security.randomString`
  - `$security.hs256("a:1", "saltkey")` → record the EXACT output (hex? base64? length?) — the PoW bit-counting on both server and client must match this encoding.
  - whether `e.requestInfo().body` returns parsed JSON for a POST (vs needing raw read).
  - whether the DAO is `e.app` or `$app` for `findFirstRecordByData` / `save` / `new Record(col)`.
  **Adjust proxy.pb.js + the frontend `solveProxyPoW` to match the real `$security.hs256` encoding before proceeding.** If `$security.hs256` isn't HMAC-SHA256-hex, switch both sides to whatever it is, or to option A (plain SHA-256) if a bare SHA-256 is available. This step de-risks the one cross-environment agreement.

- [ ] **Step 1 (pre-key): confirm the gate order works.** With NO PoW headers, the POST should reject at the PoW gate (403 "bad challenge") or 503 if key/secret unset — it should NOT reach the model/forward. Then fetch a real challenge and solve it (use a tiny node script reusing the `solveProxyPoW` logic, pointed at the deployed challenge endpoint) and confirm a solved-but-pre-key POST returns 503 (configured-gate) while origin-mismatch returns 403:
```bash
# no PoW → 403 (or 503 if secret unset):
curl -s -w "\n%{http_code}\n" -X POST https://ai.pb.gurum.se/api/claude -H "Origin: https://kalleeh.github.io" -H "Content-Type: application/json" -d '{"model":"claude-haiku-4-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
# challenge endpoint reachable:
curl -s -w "\n%{http_code}\n" "https://ai.pb.gurum.se/api/claude-challenge" -H "Origin: https://kalleeh.github.io"
# origin reject on challenge:
curl -s -w "\n%{http_code}\n" "https://ai.pb.gurum.se/api/claude-challenge" -H "Origin: https://evil.example"
```
Expected: POST → 403/503; challenge → 200 with `{nonce,salt,exp,sig,difficulty}` (or 503 pre-secret); evil origin → 403.

- [ ] **Step 2 (post-key): a fully-solved real call returns a completion** (after Task 7). Use a node script that fetches the challenge, solves the PoW (same algorithm as `solveProxyPoW`), and POSTs with the headers + `model:"claude-haiku-4-5"`:
Expected: real Anthropic JSON with `content[0].text`. **Spends a fraction of a cent (Haiku) against the $5 cap — the intended test.** Also confirm: an UNSOLVED POST → 403; a model other than Haiku (even with valid PoW) → 400; reusing the same nonce twice → 403 "already used".

- [ ] **Step 3 (post-key): budget + rate.** Confirm `proxy_budget` for today increments per successful call (PB admin or repeat). Confirm >8 calls/60s from one IP → 429. (A few solved calls = a few sub-cent charges.)

- [ ] **Step 4: frontend live check.** Open each demo (deployed/local), "try it live" with NO key → confirm the PoW solves (~200ms, shown as "thinking") and a real Haiku response renders. Paste a key → confirm direct path (full model). Force budget/rate/503 → confirm graceful fallback to canned + BYO panel.

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
Environment=PROXY_POW_SECRET=<RANDOM_STRING>
EOF
sudo chmod 0600 /etc/systemd/system/pocketbase@ai.service.d/env.conf
sudo systemctl daemon-reload
sudo systemctl restart pocketbase@ai
```
Two values: `<YOUR_KEY>` is the Anthropic key; `<RANDOM_STRING>` is any long random string for signing PoW challenges (generate with `openssl rand -hex 32` — it's not an Anthropic secret, just needs to be unguessable and stable). Both live ONLY here. (The `env.conf` is separate from the `port.conf` that `sync-backends.sh` manages, so future syncs won't touch or expose it.)

- [ ] **Step 3 (owner): confirm.** Tell the agent "key is set" — the agent then runs Task 6 Step 2–4 post-key checks.

---

## Self-review notes (verify before "done")

1. **Key hygiene:** the key + PoW secret appear in ZERO committed files, this plan, and no agent output. Only in the server's 0600 `env.conf`. ✓
2. **Safe-before-key:** all code (Tasks 1–5) ships and deploys with the proxy returning 503; demos fall back to canned + BYO. No demo breaks pre-key. ✓
3. **Wallet-protection layers all present:** Haiku-only on proxy (2a, ~10–20× cheaper) + proof-of-work gate (2c, raises abuse CPU cost) + per-IP rate 429 (8/min) + dollar-bounded daily budget 429 (~250/day, sized < $5/mo) + origin 403 + Anthropic $5 cap (owner). The honest worst case = a few dollars + fallback to BYO, not a blank check. ✓
4. **Frontend auth correctly NOT used:** public static client can't hold a secret; PoW (prove effort) replaces auth (prove identity). ✓
5. **Dumb proxy:** no system prompt server-side; frontend sends full body minus key. Opus/Sonnet only via BYO; proxy path is Haiku. ✓
6. **Non-streaming:** hook rejects stream:true; demos unchanged. ✓
7. **Downstream untouched:** proxy returns identical Anthropic JSON; only the fetch (URL/headers/model/PoW) changes. ✓
8. **The crypto-agreement risk is front-loaded:** Task 6 Step 0 probes `$security.hs256` encoding + body/DAO accessors BEFORE trusting the gate; server `leadingZeroBits(hex)` and client byte-bit-count must measure the same bits — verified before post-key testing. This is the one spot that, if mismatched, would make the PoW gate either always-pass (insecure) or always-fail (broken). ✓
9. **sync-backends.sh NOT modified to carry secrets** — env is a manual, separate drop-in. ✓
```
