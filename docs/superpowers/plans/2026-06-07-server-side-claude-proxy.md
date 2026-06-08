# Server-side Claude Proxy via Bedrock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up one shared `ai.pb.gurum.se` PocketBase proxy that authenticates to **Amazon Bedrock** with the owner's bearer token and translates demo requests to Bedrock's `invoke` API, so the four AI demos get a free, no-key "live" mode. Anti-spam only (Bedrock is unlimited): proof-of-work + per-IP rate + origin check. Convert the demos to **proxy-only** live mode, **removing** the BYO-key UI entirely.

**Architecture:** A dedicated PB 0.25.8 instance (port 8098) with `pb_hooks` routes `GET /api/claude-challenge` (PoW challenge) + `POST /api/claude` (translating proxy). The hook reads `AWS_BEARER_TOKEN_BEDROCK` / `AWS_REGION` / `PROXY_POW_SECRET` from env, validates PoW + origin + rate, maps a logical model (`opus`/`sonnet`) → Bedrock inference-profile ID, POSTs to `bedrock-runtime.<region>.amazonaws.com/model/<id>/invoke` via `$http.send`, and relays the Claude-native JSON back. Frontends call the proxy with no key; downstream parsing is unchanged.

**Tech Stack:** PocketBase 0.25.8 JSVM hooks (goja), Amazon Bedrock (eu-north-1, bearer-token auth — verified), plain static HTML/JS, systemd env drop-in, Caddy. No build tool.

**Spec:** `docs/superpowers/specs/2026-06-07-server-side-claude-proxy-design.md`. **All JSVM APIs below were confirmed via Context7 on 2026-06-08** (`/websites/pocketbase_io_jsvm`).

---

## Important constraints

- **The Bedrock token + PoW secret are NEVER in the repo, this plan, logs, or any commit.** They live only in a 0600 systemd `env.conf` on the server, set by the OWNER (Task 7). The hook reads them via `$os.getenv`. (The agent verified Bedrock works using the token present in the *dev* environment, but never prints it.)
- **Owner-only manual steps** (agent must NOT do): confirm the Bedrock token + model access; place `AWS_BEARER_TOKEN_BEDROCK`/`AWS_REGION`/`PROXY_POW_SECRET` in server env; restart the unit. Task 7 gives exact commands. Until then the proxy returns 503 and demos stay in canned mode — so all code ships safe before the token is set.
- **Anti-spam, not wallet:** Bedrock unlimited → no Haiku-lock, no dollar-budget, no $5 cap. Keep origin + PoW + per-IP rate. Optionally a high logged circuit-breaker (Task 3, decide).
- **Translating proxy:** model is in the URL path (not body); body needs `anthropic_version:"bedrock-2023-05-31"`; reject `stream:true`.
- **Verified JSVM APIs (use these exact forms):** `$http.send({method,url,headers,body,timeout})` → use `res.statusCode` + `res.json`; `$os.getenv(name)`; `$security.sha256(text)` (plain SHA-256 hex — PoW work fn); `$security.hs256(text, secret)` (HMAC-SHA256 hex — nonce signing); `$security.randomString(n)`; `$security.equal(a,b)` (constant-time); `e.bindBody(obj)` to read JSON body; `routerAdd(method, path, handler)`. Request headers via `e.request.header.get("X-…")`. (Confirm `e.request` header accessor at deploy — Task 6 Step 0; fallback `e.request.headers`.)
- **Verification** = `node --check` on the hook (syntax only — goja globals are fine) + live `curl` against the deployed proxy. The Bedrock call shape is already proven (spec §6).

---

## File Structure

```
vibe-demos/
├── backends/config.json                      ← EDIT: add "ai": { "port": 8098 }
├── ai/pb/pb_hooks/proxy.pb.js                 ← NEW: challenge + translating proxy + PoW/rate
├── ai/pb/pb_migrations/001_init_proxy_breaker.js  ← NEW (only if circuit-breaker kept)
├── intake-companion/index.html               ← EDIT: remove BYO, add proxy+PoW (model: opus)
├── clinic-admin/index.html                   ← EDIT: remove BYO, add proxy+PoW (model: opus)
├── live-globe/index.html                     ← EDIT: remove BYO, add proxy+PoW (model: sonnet)
├── korean-mbti/index.html                    ← EDIT: remove BYO, add proxy+PoW (model: sonnet)
└── (each demo's sw.js)                        ← EDIT: cache bump
```

---

## Task 1: Register the `ai` backend (config only)

**Files:** `backends/config.json`

- [ ] **Step 1:** Add `"ai": { "port": 8098 }` to the `"backends"` object (match existing formatting; 8098 is next free).
- [ ] **Step 2:** Validate JSON:
```bash
cd /home/ubuntu/projects/vibe-demos
node -e "JSON.parse(require('fs').readFileSync('backends/config.json','utf8')); console.log('CONFIG OK')"
```
Expected: `CONFIG OK`.
- [ ] **Step 3:** Commit: `git add backends/config.json && git commit -m "ai-proxy: register shared ai backend on port 8098"`

---

## Task 2: The translating Bedrock proxy hook (forward + guards, no PoW yet)

**Files:** Create `ai/pb/pb_hooks/proxy.pb.js`

- [ ] **Step 1: Write the hook.** (PoW added in Task 3; this is the forward + origin/model/body guards.)

```javascript
// ai/pb/pb_hooks/proxy.pb.js
// Translating Claude proxy → Amazon Bedrock. Auth via bearer token from env
// (AWS_BEARER_TOKEN_BEDROCK), set ONLY in the server 0600 systemd drop-in.
// Verified 2026-06-08: bearer POST to bedrock-runtime/<id>/invoke returns native
// Claude JSON for opus-4-8 and sonnet-4-6 in eu-north-1. JSVM APIs per Context7.

const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
const MAX_TOKENS_CEILING = 2048;
// Logical model -> Bedrock inference-profile id. Map lives server-side so model
// ids can change without a frontend deploy and callers can't pick arbitrary models.
const MODEL_MAP = {
  opus:   "eu.anthropic.claude-opus-4-8",
  sonnet: "eu.anthropic.claude-sonnet-4-6",
};

function originAllowed(o) {
  if (!o) return false;
  return ALLOWED_ORIGINS.some(a => o === a || o.indexOf(a) === 0);
}

routerAdd("POST", "/api/claude", (e) => {
  const token = $os.getenv("AWS_BEARER_TOKEN_BEDROCK");
  const region = $os.getenv("AWS_REGION") || "eu-north-1";
  if (!token) return e.json(503, { error: "live proxy not configured" });

  // origin check (cheap reject)
  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });

  // read JSON body
  const body = {};
  try { e.bindBody(body); } catch (err) { return e.json(400, { error: "bad body" }); }

  const logical = String(body.model || "");
  const modelId = MODEL_MAP[logical];
  if (!modelId) return e.json(400, { error: "unknown model" });
  if (body.stream === true) return e.json(400, { error: "streaming not supported" });
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return e.json(400, { error: "messages required" });
  }
  let maxTokens = Number(body.max_tokens || 0);
  if (!maxTokens || maxTokens > MAX_TOKENS_CEILING) maxTokens = Math.min(maxTokens || 1024, MAX_TOKENS_CEILING);

  // translate to Bedrock invoke shape: model in path, anthropic_version in body, no model field
  const url = "https://bedrock-runtime." + region + ".amazonaws.com/model/" + modelId + "/invoke";
  try {
    const res = $http.send({
      method: "POST",
      url: url,
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system: body.system,
        messages: body.messages,
      }),
      timeout: 60,
    });
    // res.json is the parsed Bedrock response (native Claude shape); relay verbatim.
    return e.json(res.statusCode || 200, res.json);
  } catch (err) {
    return e.json(502, { error: "upstream request failed" });
  }
});
```

- [ ] **Step 2: Syntax check.**
```bash
cd /home/ubuntu/projects/vibe-demos
node --check ai/pb/pb_hooks/proxy.pb.js && echo "HOOK SYNTAX OK"
```
Expected: `HOOK SYNTAX OK`.
- [ ] **Step 3: Commit:** `git add ai/pb/pb_hooks/proxy.pb.js && git commit -m "ai-proxy: translating Bedrock proxy hook (origin/model/body guards)"`

---

## Task 3: Add proof-of-work gate + per-IP rate (+ optional circuit-breaker)

**Files:** Modify `ai/pb/pb_hooks/proxy.pb.js`; optionally create `ai/pb/pb_migrations/001_init_proxy_breaker.js`.

PoW uses **plain SHA-256** on both sides (server `$security.sha256`, client Web Crypto `SHA-256`) over the identical string `nonce:counter` — no salt/HMAC bit-matching subtlety. The nonce is HMAC-signed so it can't be forged.

- [ ] **Step 1: Add constants + the challenge route.** At the top of `proxy.pb.js`:
```javascript
const POW_DIFFICULTY = 16;          // leading zero BITS; tune so a phone solves ~150-300ms
const POW_TTL_MS = 2 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;                 // per-IP calls / window
const ipHits = new Map();           // ip -> [timestamps]  (in-memory; resets on restart)
const usedNonces = new Map();       // nonce -> exp ms      (replay guard)

function powSecret() { return $os.getenv("PROXY_POW_SECRET") || ""; }

// leading zero BITS of a hex string
function leadingZeroBits(hex) {
  let bits = 0;
  for (let i = 0; i < hex.length; i++) {
    const n = parseInt(hex[i], 16);
    if (n === 0) { bits += 4; continue; }
    if (n < 2) bits += 3; else if (n < 4) bits += 2; else if (n < 8) bits += 1;
    break;
  }
  return bits;
}

routerAdd("GET", "/api/claude-challenge", (e) => {
  const secret = powSecret();
  if (!secret) return e.json(503, { error: "live proxy not configured" });
  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const nonce = $security.randomString(24);
  const exp = String(Date.now() + POW_TTL_MS);
  const sig = $security.hs256(nonce + ":" + exp, secret);   // binds nonce to our secret
  return e.json(200, { nonce: nonce, exp: exp, sig: sig, difficulty: POW_DIFFICULTY });
});
```

- [ ] **Step 2: Verify PoW + rate at the top of the POST handler** (insert right after the `token`/503 check, before the origin check). Reads headers `X-PoW-Nonce/Exp/Sig/Counter`:
```javascript
  const secret = powSecret();
  if (!secret) return e.json(503, { error: "live proxy not configured" });
  const h = e.request.header;
  const pNonce = h.get("X-PoW-Nonce") || "", pExp = h.get("X-PoW-Exp") || "",
        pSig = h.get("X-PoW-Sig") || "", pCounter = h.get("X-PoW-Counter") || "";
  // 1) authentic + unexpired nonce (constant-time compare)
  if (!$security.equal(pSig, $security.hs256(pNonce + ":" + pExp, secret))) {
    return e.json(403, { error: "bad challenge" });
  }
  if (!pExp || Date.now() > Number(pExp)) return e.json(403, { error: "challenge expired" });
  // 2) replay guard (prune expired cheaply)
  const nowp = Date.now();
  for (const [k, v] of usedNonces) { if (v < nowp) usedNonces.delete(k); }
  if (usedNonces.has(pNonce)) return e.json(403, { error: "challenge already used" });
  // 3) the work: SHA256(nonce:counter) must have POW_DIFFICULTY leading zero bits
  if (leadingZeroBits($security.sha256(pNonce + ":" + pCounter)) < POW_DIFFICULTY) {
    return e.json(403, { error: "insufficient proof-of-work" });
  }
  usedNonces.set(pNonce, Number(pExp));
  // 4) per-IP rate limit
  const ip = (h.get("X-Forwarded-For") || "").split(",")[0].trim() || "unknown";
  const arr = (ipHits.get(ip) || []).filter(t => nowp - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return e.json(429, { error: "rate limit — try again shortly" });
  arr.push(nowp); ipHits.set(ip, arr);
```

- [ ] **Step 3 (optional circuit-breaker — decide at build):** If keeping it, add migration `001_init_proxy_breaker.js` (a `proxy_breaker { day text, calls number }` collection, locked rules) and in the handler, after a successful forward, increment today's row; before forwarding, if `calls >= BREAKER_CEILING` (set high, e.g. 5000/day — NOT a cost limit, a runaway-loop tripwire) return 429 and `console.log` that the breaker tripped. Mirror the Anthropic plan's budget-collection pattern but with the high ceiling + "circuit breaker tripped" logging. If skipping, note in the commit that no breaker was added.

- [ ] **Step 4: Syntax + commit:**
```bash
cd /home/ubuntu/projects/vibe-demos
node --check ai/pb/pb_hooks/proxy.pb.js && echo "HOOK SYNTAX OK"
git add ai/pb/pb_hooks/proxy.pb.js   # + migration if added
git commit -m "ai-proxy: proof-of-work gate + per-IP rate limit (anti-spam)"
```

---

## Task 4: Deploy the `ai` backend (agent — provisions instance, NO token yet)

**Files:** none (deploy)

- [ ] **Step 1:** `cd /home/ubuntu/projects/vibe-demos && ./sync-backends.sh` — provisions `pocketbase@ai` on 8098, Caddy host `ai.pb.gurum.se`, reloads Caddy.
- [ ] **Step 2:** Health: `curl -s -o /dev/null -w "%{http_code}\n" --max-time 12 https://ai.pb.gurum.se/api/health` → `200`.
- [ ] **Step 3:** Pre-token gate: `curl -s -w "\n%{http_code}\n" https://ai.pb.gurum.se/api/claude-challenge -H "Origin: https://kalleeh.github.io"` → `503` (secret unset) — confirms hooks loaded + env-gate works. (No commit.)

---

## Task 5: Convert the four frontends to proxy-only live mode (REMOVE BYO)

Each demo: **delete** the API-key UI + localStorage + direct Anthropic path, and route live calls through the proxy with PoW. The proxy returns the same Claude shape, so response parsing is untouched.

**Files:** the four `index.html` + their `sw.js`.

- [ ] **Step 1: Add the shared PoW solver + proxy call to each demo** (demos are self-contained — paste into each demo's script once):
```javascript
  const CLAUDE_PROXY = "https://ai.pb.gurum.se";
  async function solveProxyPoW() {
    const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge");
    if (!r.ok) { const e = new Error("challenge"); e.status = r.status; throw e; }
    const { nonce, exp, sig, difficulty } = await r.json();
    const enc = new TextEncoder();
    const leadBits = (buf) => { const b = new Uint8Array(buf); let bits = 0;
      for (const x of b) { if (x === 0) { bits += 8; continue; }
        let v = x, c = 0; while ((v & 0x80) === 0) { c++; v <<= 1; } bits += c; break; } return bits; };
    for (let counter = 0; ; counter++) {
      const digest = await crypto.subtle.digest("SHA-256", enc.encode(nonce + ":" + counter));
      if (leadBits(digest) >= difficulty) {
        return { "X-PoW-Nonce": nonce, "X-PoW-Exp": exp, "X-PoW-Sig": sig, "X-PoW-Counter": String(counter) };
      }
      if (counter > 5000000) throw new Error("pow-timeout");
    }
  }
  // model: "opus" | "sonnet" (per demo). Returns the parsed Claude JSON (same shape as before).
  async function callViaProxy({ model, system, messages, max_tokens }) {
    const pow = await solveProxyPoW();
    const res = await fetch(CLAUDE_PROXY + "/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...pow },
      body: JSON.stringify({ model, system, messages, max_tokens: max_tokens || 1024 }),
    });
    if (!res.ok) { const e = new Error("proxy " + res.status); e.status = res.status; throw e; }
    return res.json();
  }
```
> Server/client PoW agreement: both hash `nonce + ":" + counter` with plain SHA-256 and count leading zero bits. Server uses `$security.sha256` (hex) + `leadingZeroBits(hex)`; client uses Web Crypto SHA-256 (bytes) + `leadBits(bytes)`. Same algorithm, same input → same bits. Confirm once in Task 6.

- [ ] **Step 2 (per demo): rewire the existing call + DELETE the BYO UI.** For each of `intake-companion` (model `opus`), `clinic-admin` (`opus`), `live-globe` (`sonnet`), `korean-mbti` (`sonnet`):
  - Find the existing `callClaude(...)` (or equivalent) that fetched `api.anthropic.com`. Replace its fetch body with a call to `callViaProxy({ model: "<opus|sonnet>", system: sys, messages: [...], max_tokens: <existing, ≤2048> })` and return the same parsed result the demo expects (the response shape is unchanged, so existing `.content[0].text` parsing stays).
  - **Delete** the key-prompt panel HTML, the "paste from clipboard" / "forget my key" buttons, the `getKey()`/`setKey()` helpers, the `vibe.<slug>.key` localStorage reads/writes, and the 401-re-prompt logic. Remove the `key` param from `callClaude`'s signature.
  - On a live error (403/429/503), show a calm "live demo is busy right now" and stay in canned mode (don't reveal a now-removed key panel). Keep the demo's existing loading motion around the PoW solve + call.
  - Preserve each demo's exact `system` prompt and `messages` construction — only the transport changes.
  - Commit per demo: `git commit -m "<demo>: proxy-only live mode via Bedrock (<model>), remove BYO key"`.

- [ ] **Step 3: Bump each demo's SW cache** (one commit for all four sw.js version bumps).

- [ ] **Step 4: Syntax sanity** per demo (the AI call usually lives in a classic `<script>`, no bare imports): confirm each file still reads/parses (open-check or extract the script and `node --check` if it's a module). Commit.

---

## Task 6: Live verification (Step 0 + pre-token now; full after Task 7)

**Files:** none

- [ ] **Step 0 (confirm the 2 JSVM accessors on the deployed instance, before trusting the gate):** drop a throwaway probe (or reuse a /tmp test instance) to confirm: `e.request.header.get(...)` returns request headers in a route; `e.bindBody({})` populates a JSON POST body; `$security.sha256("a:1")` and `$security.hs256("a:1","k")` return hex strings. Adjust the hook's header/body accessors if PB differs. (Low risk — Context7-confirmed — but verify the header `.get` shape.)
- [ ] **Step 1 (pre-token gate + guards):**
```bash
# challenge before secret set → 503 (or 200 after Task 7):
curl -s -w "\n%{http_code}\n" https://ai.pb.gurum.se/api/claude-challenge -H "Origin: https://kalleeh.github.io"
# evil origin → 403:
curl -s -w "\n%{http_code}\n" https://ai.pb.gurum.se/api/claude-challenge -H "Origin: https://evil.example"
# POST without PoW → 403/503 (must NOT reach Bedrock):
curl -s -w "\n%{http_code}\n" -X POST https://ai.pb.gurum.se/api/claude -H "Origin: https://kalleeh.github.io" -H "Content-Type: application/json" -d '{"model":"opus","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
```
- [ ] **Step 2 (post-token — after Task 7): a solved real call returns a completion.** Use a small node script that GETs the challenge, solves the SHA-256 PoW (same algo as `solveProxyPoW`), and POSTs with the headers + `model:"sonnet"`. Expected: native Claude JSON with `content[0].text` (a real Sonnet reply via Bedrock). Also confirm: unsolved POST → 403; `model:"gpt-4"` → 400; reused nonce → 403; >8 calls/60s/IP → 429.
- [ ] **Step 3: frontend live check.** Each demo, "try it live" → PoW solves (~200ms) → real response renders (Opus for clinic/intake, Sonnet for globe/mbti). Confirm the BYO key panel is GONE. Force 503/429 → graceful canned fallback.

---

## Task 7: OWNER-ONLY — set the Bedrock token + PoW secret in server env

> **Performed by the human owner, not the agent.** The agent presents these commands and waits. Token/secret never appear in the repo, this plan, or agent output.

- [ ] **Step 1 (owner):** Confirm in the AWS console: the Bedrock bearer token is valid (already verified working from the dev env), and `eu.anthropic.claude-opus-4-8` + `eu.anthropic.claude-sonnet-4-6` are enabled in eu-north-1 (verified). Optionally set CloudWatch/Bedrock usage alarms as a backstop.
- [ ] **Step 2 (owner): place the env vars in a 0600 drop-in on the server.** Replace `<TOKEN>` and `<RANDOM>`:
```bash
ssh pb-backends
sudo install -m 0600 /dev/null /etc/systemd/system/pocketbase@ai.service.d/env.conf
sudo tee /etc/systemd/system/pocketbase@ai.service.d/env.conf >/dev/null <<'EOF'
[Service]
Environment=AWS_BEARER_TOKEN_BEDROCK=<TOKEN>
Environment=AWS_REGION=eu-north-1
Environment=PROXY_POW_SECRET=<RANDOM>
EOF
sudo chmod 0600 /etc/systemd/system/pocketbase@ai.service.d/env.conf
sudo systemctl daemon-reload
sudo systemctl restart pocketbase@ai
```
`<TOKEN>` = the Bedrock bearer token; `<RANDOM>` = `openssl rand -hex 32` output (PoW signing secret, not an AWS secret). Both live ONLY here — separate from the `port.conf` the sync script manages, so syncs never touch/expose them.
- [ ] **Step 3 (owner):** Say "token is set" — the agent runs Task 6 Step 2–3 post-token checks.

---

## Self-review notes (verify before "done")

1. **Secret hygiene:** Bedrock token + PoW secret in ZERO committed files / this plan / agent output. Only in the server 0600 `env.conf`. ✓
2. **Safe-before-token:** all code (Tasks 1–5) deploys with the proxy at 503; demos stay canned. No demo breaks pre-token. ✓
3. **Anti-spam stack:** origin 403 + PoW 403 + per-IP rate 429 (+ optional high circuit-breaker). No cost layers (Bedrock unlimited). ✓
4. **Translating proxy correct:** model in URL path, `anthropic_version` in body, no `model` field to Bedrock; server-side logical→real model map; `res.json`/`res.statusCode` relayed. ✓
5. **PoW agreement trivial:** plain SHA-256 over `nonce:counter` on both server (`$security.sha256`) and client (Web Crypto) — same algo, same input, same bit count. Verified once in Task 6 Step 0. ✓
6. **BYO fully removed:** key panel, clipboard/forget buttons, `vibe.<slug>.key`, 401-reprompt, direct api.anthropic.com path all deleted from the four demos. Net code reduction. ✓
7. **Downstream untouched:** Claude-native response shape preserved → existing `.content[0].text` parsing stays. ✓
8. **Per-demo models:** opus → clinic-admin + intake-companion; sonnet → live-globe + korean-mbti. ✓
9. **sync-backends.sh NOT modified to carry secrets** — env is a manual separate drop-in. ✓
