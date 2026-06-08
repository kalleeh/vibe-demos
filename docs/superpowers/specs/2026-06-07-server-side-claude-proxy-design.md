# Server-side Claude proxy via Bedrock (design spec)

**Date:** 2026-06-07 (revised 2026-06-08 → Bedrock)
**Scope:** Give the AI demos a free, no-key "live" mode by routing Claude calls through a shared server-side proxy that authenticates to **Amazon Bedrock** with the owner's bearer token. Replaces the earlier Anthropic-API-key design (superseded — see §0). No client key, no per-viewer signup. Abuse controls remain, but reframed as **anti-spam** (Bedrock access is unlimited), not wallet protection.

**Affected demos:** the four that call Claude — `intake-companion`, `live-globe`, `clinic-admin`, `korean-mbti` (all non-streaming).

---

## 0. Why Bedrock, and what changed from the first draft

The first draft proxied the **Anthropic API** with a $5-capped key, so its whole spine was *protect the cap* (Haiku-only, dollar-budget). Two findings on the live infra changed the design:

- **IAM instance role is NOT an option.** The Lightsail box only exposes AWS's own `AmazonLightsailInstanceRole` (verified via IMDS); Lightsail does not allow attaching a custom Bedrock policy. So "use an instance role" is impossible here.
- **Bedrock bearer-token auth works and is unlimited.** Verified end-to-end (2026-06-08): a `Authorization: Bearer <token>` POST to `bedrock-runtime.eu-north-1.amazonaws.com/model/<id>/invoke` returned real completions from **both** `eu.anthropic.claude-opus-4-8` and `eu.anthropic.claude-sonnet-4-6`, in the native Claude `{content:[{text}]}` shape. No SigV4 signing needed — a plain bearer header, settable in env exactly like the old key.

**Consequences (all simplifications):**
- Wallet-drain risk effectively gone → **drop** Haiku-only and the dollar-budget. Serve premium models freely.
- Remaining risk is **spam/abuse** (reputation, gross-to-leave-open) → **keep** proof-of-work + per-IP rate + origin check, reframed as anti-spam.
- **BYO-key path removed entirely** (owner decision): live mode = Bedrock proxy only. This *removes* the key-paste panel, `localStorage` key handling, and the direct `api.anthropic.com` path from all four demos — a net code reduction.
- Response shape is Claude-native → **zero** downstream parsing changes in the demos.

---

## 1. Architecture — one shared Bedrock-proxy backend

### 1.1 Topology

A single dedicated PocketBase instance: **`ai.pb.gurum.se`, port 8098** (next free). All four demos call its one route. One token to rotate, one rate-limiter, one config. The proxy needs **no collections** for forwarding (the route is collection-independent); it uses one tiny collection only if we keep an optional circuit-breaker counter (§3).

> Per the repo's standing rule (memory `reference_pocketbase_context7`): PB churns fast — the JSVM APIs below were confirmed against Context7 (`/websites/pocketbase_io_jsvm`) on 2026-06-08. Server binary is 0.25.8.

### 1.2 The proxy route (`pb_hooks`) — a *translating* proxy

`ai/pb/pb_hooks/proxy.pb.js` registers `POST /api/claude`. Unlike the Anthropic dumb-forward, this **translates** the request to Bedrock's invoke shape:

- **Auth:** `Authorization: Bearer ${$os.getenv("AWS_BEARER_TOKEN_BEDROCK")}` (token in server env only; never in repo).
- **Region:** from `$os.getenv("AWS_REGION")` (eu-north-1).
- **Endpoint:** `https://bedrock-runtime.<region>.amazonaws.com/model/<modelId>/invoke`.
- **Model selection (server-side):** the frontend sends a logical `model` key (`"opus"` | `"sonnet"`); the hook maps it to the real Bedrock inference-profile ID (`eu.anthropic.claude-opus-4-8` / `eu.anthropic.claude-sonnet-4-6`). Keeping the map server-side means the model IDs can change without a frontend deploy, and a caller can't request an arbitrary model.
- **Body translation:** drop `model` from the body (it's in the URL path); ensure `anthropic_version: "bedrock-2023-05-31"`; pass `max_tokens`, `system`, `messages` through. Reject `stream:true`.
- **Forward:** `$http.send({ method:"POST", url, headers, body, timeout:60 })`; relay `res.statusCode` + `res.json` (both are first-class on the response object per JSVM docs) straight back. The body the demos receive is Bedrock's Claude-native JSON — identical shape to today.
- **Never log** the token, prompt, or response. Log only timestamp, IP hash, logical model, allow/deny reason.

### 1.3 Per-demo model assignment (owner decision)

| Demo | Logical model | Real Bedrock ID | Why |
|---|---|---|---|
| `clinic-admin` | `opus` | `eu.anthropic.claude-opus-4-8` | clinical reasoning / structured 행정 briefs — intelligence carries it |
| `intake-companion` | `opus` | `eu.anthropic.claude-opus-4-8` | 변증/처방 structured brief — the reference AI demo |
| `live-globe` | `sonnet` | `eu.anthropic.claude-sonnet-4-6` | "right now" blurbs — fast, ample |
| `korean-mbti` | `sonnet` | `eu.anthropic.claude-sonnet-4-6` | free-text deep-read — Sonnet is plenty |

---

## 2. The security reframe (anti-spam, not wallet)

The endpoint is reachable by anyone on the internet, and **PocketBase auth cannot gate a public static frontend** — any credential the HTML holds is in view-source. So we don't authenticate *who* calls; we make casual scripted abuse **annoying and slow** (good enough, since there's no dollar cap to protect — only reputation / not-leaving-an-open-relay):

| Layer | Where | Role (now anti-spam) |
|---|---|---|
| 1. Token in systemd `Environment=`, never in repo/frontend/logs | server | hides the Bedrock token |
| 2a. Origin check (`Origin`/`Referer` ∈ kalleeh.github.io + localhost) | hook | rejects casual hotlinking (soft, spoofable) |
| 2b. Proof-of-work (frontend solves a SHA-256 puzzle per call) | hook + frontend | raises per-call CPU cost → scripted spam is slow; ~200ms once for a real viewer; fully self-hosted |
| 2c. Per-IP rate limit (~8/60s) | hook | caps burst from one source |
| 3. (optional) circuit-breaker daily ceiling | hook | NOT for cost — auto-disables if a runaway script blows past a sane number; logs what was dropped |

Dropped vs. the Anthropic draft: Haiku-only, the dollar-sized budget, the $5 cap. Kept: origin + PoW + rate. The honest worst case is now "some wasted Bedrock calls + PoW slows the abuser," not any dollar loss.

### 2.1 Proof-of-work (simplified by `$security.sha256`)

Context7 confirms PB exposes `$security.sha256(text)` (plain SHA-256 hex) AND `$security.hs256(text, secret)` (HMAC-SHA256 hex). So PoW uses **plain SHA-256** — which the browser mirrors *exactly* with `crypto.subtle.digest("SHA-256", …)` (no salt/HMAC bit-matching subtlety):

- `GET /api/claude-challenge` → `{ nonce, exp, sig, difficulty }` where `nonce=$security.randomString(24)`, `sig=$security.hs256(nonce+":"+exp, POW_SECRET)` (binds the nonce so it can't be forged), short `exp`.
- Frontend finds `counter` such that `SHA256(nonce+":"+counter)` has `difficulty` leading zero bits (Web Crypto), sends `nonce/exp/sig/counter` in headers.
- Hook verifies: `$security.equal(sig, hs256(nonce+":"+exp, secret))` (constant-time), not expired, nonce not already spent (in-memory replay set), and `$security.sha256(nonce+":"+counter)` has ≥ `difficulty` leading zero bits. Both sides hash the identical string with the identical algorithm — no cross-impl ambiguity.
- `POW_SECRET` is a second env var (`PROXY_POW_SECRET`), owner-set alongside the token.

---

## 3. Frontend changes — proxy-only live mode (BYO removed)

Each demo's flow becomes **canned ↔ live** (two states, was three):

1. **Canned mode (default)** — unchanged; no calls.
2. **"Try it live"** — (a) `GET /api/claude-challenge`, (b) solve PoW (~200ms, shown via the demo's existing loading motion), (c) `POST /api/claude` with PoW headers + `{ model: "<opus|sonnet>", max_tokens, system, messages }`. Renders the response exactly as today (same Claude shape). On 429/403/503 → calm "live demo is busy / unavailable right now" + stay in canned.

**Removed from all four demos:** the API-key prompt panel, "paste from clipboard"/"forget my key" buttons, the `vibe.<slug>.key` localStorage, the 401-key-rejected flow, and the direct `api.anthropic.com` fetch. The `callClaude()` keeps its signature minus the `key` arg; its body now targets the proxy. This is a deletion-heavy change — simpler than today.

**Privacy (clinic-admin):** unchanged promise — the demo already sends only canned/example inputs to Claude, not real PII. Bedrock sees the same example inputs. Keep example-only inputs; the proxy doesn't change what's sent.

**Honesty:** live results are real Opus 4.8 / Sonnet 4.6 (via Bedrock). Label per the model served; no canned/live ambiguity (a small "live · Opus" vs "demo" pill).

---

## 4. Deploy & ops

- `backends/config.json`: add `"ai": { "port": 8098 }`.
- `ai/pb/pb_hooks/proxy.pb.js` + (if circuit-breaker) `ai/pb/pb_migrations/001_*.js` — committed (code, not secrets).
- `sync-backends.sh` provisions instance + systemd + Caddy as usual. **Owner-only, out-of-band:** a 0600 `.d/env.conf` drop-in with `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION`, `PROXY_POW_SECRET`. NOT in the repo, NOT written by the sync script (verified: it only writes `port.conf`).
- **Token rotation:** edit `env.conf` + `systemctl restart pocketbase@ai`. One place. (Bedrock bearer tokens can be regenerated in the AWS console; rotating is cheap.)
- Health endpoint stays public (no token) for the demos' health check.

---

## 5. What the agent builds vs. owner-only

**Agent (no secret):** config entry, the translating hook + PoW + rate logic, the per-demo frontend conversion (delete BYO, add proxy+PoW call), the optional circuit-breaker, docs. All committable. The agent already verified the Bedrock call works using the token present in the *dev* environment — but never prints it.

**Owner-only (never the agent):**
1. Confirm/generate the Bedrock bearer token + confirm Opus 4.8 / Sonnet 4.6 are enabled in eu-north-1 (already verified working).
2. Place `AWS_BEARER_TOKEN_BEDROCK` + `AWS_REGION` + `PROXY_POW_SECRET` in the server's 0600 `env.conf`.
3. `systemctl restart pocketbase@ai`.

Until done, the proxy returns 503 and demos stay in canned mode — so all code ships safely before the server token is set.

---

## 6. Verified facts (2026-06-08)

- ✅ Bedrock bearer auth + invoke path + body shape — real completions from Opus 4.8 AND Sonnet 4.6 in eu-north-1 (tested with the dev-env token; the Lightsail box separately confirmed network-reachable to the endpoint, path returns 403-not-404 = format valid).
- ✅ Lightsail cannot use a custom IAM role (only `AmazonLightsailInstanceRole`).
- ✅ JSVM APIs (Context7, 0.25.8): `$http.send` (`res.json`/`res.statusCode`), `$os.getenv`, `$security.sha256` (plain SHA-256 — enables clean PoW), `$security.hs256` (HMAC, nonce signing), `$security.randomString`, `$security.equal` (constant-time), `e.bindBody(&data)` for JSON body, `routerAdd`.
- ✅ systemd template + per-instance `.d/` drop-ins; sync script writes only `port.conf`.

No load-bearing unknowns remain. The one cross-environment agreement (server vs client PoW hash) is now trivial — both use **plain SHA-256 over the same string**.

---

## 7. Open question (minor)

- **Circuit-breaker: include or skip?** With unlimited Bedrock there's no cost reason, but a generous daily ceiling (e.g. auto-disable + log if calls exceed N×normal in a day) is cheap insurance against a runaway loop hammering Bedrock and tripping account-level abuse heuristics. Lean: include a high, logged ceiling purely as a circuit-breaker. Decide at plan time.
