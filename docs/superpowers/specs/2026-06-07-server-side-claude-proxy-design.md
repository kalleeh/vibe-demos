# Server-side Claude key proxy (design spec)

**Date:** 2026-06-07
**Scope:** Move the Anthropic API key off the client into a shared server-side proxy, so casual viewers get "live" AI with no key paste — without exposing the key and without handing strangers a "spend my money" button. Keep the existing BYO-key path as an unlimited fallback (hybrid model).

**Affected demos:** the four that call Claude — `intake-companion`, `live-globe`, `clinic-admin`, `korean-mbti`. (Verified: all four are **non-streaming** today, which removes the SSE-passthrough risk entirely.)

---

## 1. Problem & intent

Today every AI demo is **BYO-key**: the viewer pastes their own Anthropic key (stored per-demo in `localStorage`, e.g. `vibe.intake-companion.key`), and the browser calls `api.anthropic.com` directly with `anthropic-dangerous-direct-browser-access`. This is deliberately zero-cost and zero-abuse-surface for the owner — but it's friction: most viewers won't have a key, so they only ever see canned mode.

**Intent:** add a server-side proxy holding the owner's key so a viewer can tap "try it live" and get a real Claude response with no signup. The literal ask ("move the key server-side securely") is the easy part; the real work is ensuring the proxy endpoint is **not a public wallet drain**.

**Non-goals:**
- NOT moving system prompts server-side (decided: dumb proxy — prompts stay in the frontend, view-source visible, easy to edit; this matches the "portfolio shows the prompt-craft" spirit and avoids making prompt edits a backend deploy).
- NOT dropping BYO-key (decided: hybrid — see §4).
- NOT adding streaming (all four demos are non-streaming; keep it that way).

---

## 2. The security reframe (read this first)

Moving the key server-side does not remove risk — it **changes its shape**, from "don't leak a key" to "don't let strangers drain the account." A proxy that calls Claude with the owner's key is by default a public "spend my money" button; PocketBase collection rules do NOT protect custom `pb_hooks` routes, so **the route is reachable by anyone on the internet who finds the URL.**

**Two separate "securities" — keep them apart:**
- **Key security: NOT lowered.** The key never leaves the server / never hits the browser / never enters the repo. Genuinely safe.
- **Wallet exposure: a NEW risk.** Today (BYO-key) the owner spends $0 — every call is on the viewer's key. The proxy creates a public spend surface that did not exist before. The honest worst case is not "key stolen" but "an abuser burns the monthly cap and the live demo goes dark until reset." We make that worst case **small and bounded**, not zero.

**Why frontend auth can't fix this (asked + answered):** PocketBase has real auth (password/OAuth/tokens), but it does NOT help here, because the frontend is **public static HTML** — any credential it holds is in view-source for an abuser to copy. PB collection rules also don't apply to custom hook routes. A public client fundamentally cannot hold a secret. So the gate cannot be "prove who you are" (impossible); it must be **"prove you spent effort"** → proof-of-work (Layer 2c).

"Securely" therefore means these layers (decided posture: **bound the dollars, raise the abuse cost — fully self-hosted, no third party**):

| Layer | Where | Effort | Role |
|---|---|---|---|
| 1. Key in systemd `Environment=`, never in repo/frontend/logs | server | trivial | hides the key (the literal ask) |
| 2a. **Haiku-only on the proxy path** (Opus/Sonnet via BYO-key only) | hook | trivial | cuts per-call cost ~10–20× → the $5 cap stretches far, each abusive call is near-worthless |
| 2b. **Dollar-bounded daily budget** + per-IP rate + origin check | hook | the real work | sized so even a full day of abuse stays well under $5 → demo survives the month |
| 2c. **Proof-of-work gate** (frontend solves a hash puzzle per call) | hook + frontend | moderate | the only self-hosted layer that *raises* per-call cost for the abuser (~200ms once for a real viewer); no signup, no third party |
| 3. Anthropic-side spend cap ($5/mo) + model allow-list | console | trivial (manual) | the hard backstop when all else fails |
| 4. ~~Streaming passthrough~~ | — | n/a | **eliminated** — demos are non-streaming |

Layer 1 alone just relocates risk. **2a is non-negotiable** (it makes every other number forgiving). 2b bounds the dollar loss. 2c raises the attacker's cost without a third party. 3 is the hard ceiling. Note: PoW *raises* abuse cost, it doesn't *prevent* it — a determined attacker with CPU can still grind; the dollar-bound + Haiku-only ensure that even then the loss is a few dollars, not a blank-check. (A true *prevention* layer would be Cloudflare Turnstile, deliberately NOT chosen here to stay fully self-hosted / signup-free.)

---

## 3. Architecture — one shared AI-proxy backend

### 3.1 Topology (decided)

A single new PocketBase instance dedicated to the proxy: **`ai.pb.gurum.se`, port 8098** (next free; 8091–8097 are taken). All four AI demos call this one endpoint. Rationale: one key to rotate, one rate-limiter, one config — vs. per-demo hooks (4 keys/configs to drift) which buy nothing for a dumb proxy. (This is the same "shared backend beats per-demo" lesson the cross-demo `users` problem surfaced.)

> Note: this instance does NOT need any collections for the proxy itself — the hook route is independent of collections. (It MAY later also host a shared `users` collection if the deferred login work wants one, but that's out of scope here.)

### 3.2 The proxy route (`pb_hooks`)

PocketBase 0.25.8 supports `pb_hooks/*.pb.js` custom routes via the JSVM. Add `ai/pb/pb_hooks/proxy.pb.js` registering `POST /api/claude`:

- Reads the owner key from env: `$os.getenv("ANTHROPIC_PROXY_KEY")`.
- **Proof-of-work gate (Layer 2c):** require a valid PoW solution header before doing anything expensive (see §3.3).
- **Origin check:** reject unless `Origin`/`Referer` is `https://kalleeh.github.io` (and `http://localhost*` for local dev). Soft control (spoofable by non-browsers) but stops casual hotlinking.
- **Model lock (Layer 2a — the key cost control):** the proxy path is **Haiku-only**. Reject any `model` ≠ `claude-haiku-4-5`. Opus/Sonnet remain available, but ONLY via the BYO-key direct path (the viewer pays). This cuts per-call cost ~10–20× so the $5 cap stretches far and each abusive call is near-worthless. The frontend "try it live" sends `claude-haiku-4-5`; "use my own key" keeps the full model toggle.
- **Body shape guard:** require `max_tokens <= 1024` (Haiku, short demo outputs), `messages` array present, reject `stream: true`.
- **Dumb forward:** inject `x-api-key` + `anthropic-version`, forward the (validated) body to `https://api.anthropic.com/v1/messages` via `$http.send`, return Anthropic's JSON response and status straight back.
- **Never log** the key, the full prompt, or the response body. Log only: timestamp, IP hash, model, token count, allow/deny reason.

### 3.3 Abuse control (Layer 2 — bound the dollars + raise the cost)

Gates in the hook, cheapest-reject first:
1. **Origin check** — instant reject of non-allowed origins (soft).
2. **Proof-of-work (2c):** the frontend must solve a hash puzzle before each call. The proxy exposes `GET /api/claude-challenge` returning `{ nonce, difficulty, exp }` (nonce = random, signed/HMAC'd with a server secret so it can't be forged, short expiry). The frontend hashes `nonce + counter` (SHA-256) until the digest has `difficulty` leading zero bits, then sends `counter` + `nonce` in the `POST /api/claude` headers. The hook verifies in ONE hash: recompute, check leading zeros, check the nonce's HMAC + expiry + that it hasn't been used (track spent nonces briefly in-memory). Difficulty tuned so a real device solves in ~150–300ms; an abuser pays that CPU **per call**, making mass abuse slow and expensive for them while a viewer barely notices. Pure self-hosted — no third party. (Raises cost; does not fully prevent — that's fine given 2a + 2b bound the dollars.)
3. **Per-IP rate limit:** ~8 calls / 60s per client IP. Prefer PocketBase 0.25's built-in rate limiter (Settings, rule on `/api/claude`) if it cleanly covers custom routes; else an in-hook sliding-window keyed by IP in an in-memory map (resets on restart — acceptable). 
4. **Dollar-bounded daily budget (2b):** a persisted per-day counter (tiny `proxy_budget { day, calls }` collection). The ceiling is sized in **dollars, not arbitrary calls**: at Haiku rates with `max_tokens<=1024`, pick a daily call cap whose worst-case daily cost is a small fraction of the $5/mo (e.g. so a full month of maxed days still lands under $5 — concretely on the order of ~150–250 calls/day; compute exact number at plan time from current Haiku pricing). On exceed → 429 "daily demo budget reached — paste your own key for unlimited," frontend falls back to canned + BYO.

IP comes from Caddy's `X-Forwarded-For` (Caddy terminates TLS). The hook reads the forwarded IP, not localhost. The PoW + nonce-signing secret is a SECOND env var (`PROXY_POW_SECRET`) set alongside the key in the same systemd drop-in.

### 3.4 Anthropic-side backstop (Layer 3 — manual, owner-only)

These are **console steps the owner performs; never automated, never in the repo:**
- Dedicated workspace + a per-key **monthly spend cap ($5)**.
- Restrict the key to the three allow-listed models.
- Email alerts at $1 / $3 / $5.
- The key value is set ONLY in the server's systemd unit `Environment=ANTHROPIC_PROXY_KEY=...` (or an `EnvironmentFile=` with 0600 perms), never committed, never echoed.

---

## 4. Frontend changes — hybrid key model (decided)

Each of the four demos keeps its three-state flow, matching the repo's "canned-first, live-optional" ethos:

1. **Canned mode (default)** — unchanged; no calls, no key.
2. **"Try it live" (new)** — (a) `GET /api/claude-challenge`, (b) solve the proof-of-work in a tiny inline worker / loop, (c) `POST /api/claude` with the PoW headers and `model: "claude-haiku-4-5"` (forced — the proxy rejects other models), no key. On 429 (rate/budget) or 503 (not configured) → calm message "demo's live budget is maxed — paste your own key below for unlimited," fall back to canned + BYO panel. The PoW solve (~150–300ms) happens with a small "thinking…" affordance so it doesn't read as lag.
3. **"Use my own key" (existing)** — unchanged; unlimited, on the viewer's dime, calls `api.anthropic.com` directly with their key, **full model toggle (Opus/Sonnet/Haiku) available here.** Still the power-user path.

Implementation shape per demo: a small branch in the existing `callClaude()` — if the viewer has pasted a key → direct path (existing code, any model); else → proxy path (fetch challenge, solve PoW, POST to `ai.pb.gurum.se` with Haiku forced, no key header). Local-first/canned fallback on any error / 429 / 503. The per-demo `vibe.<slug>.key` localStorage stays for the BYO path. A shared ~30-line PoW helper (fetch-challenge + solve) is duplicated into each demo (demos are self-contained — no shared JS), or kept minimal.

> Model note: the proxy path always uses Haiku — so the "wow run" (Opus) is only via BYO-key. This is a deliberate cost tradeoff: casual viewers get a real-but-cheap Haiku response for free; the premium models stay on the viewer's dime. Frame the live result honestly (it's Haiku) rather than implying Opus.

**Privacy note (clinic-admin):** clinic-admin's promise is patient data never leaves the browser. The proxy sees whatever the demo sends to Claude today — which is already canned/example data in the demo, not real PII. The proxy does not change what's sent; it just swaps who holds the key. Keep the demo's example-only inputs; do not start sending real patient text through the proxy.

---

## 5. Deploy & ops

- `backends/config.json`: add `"ai": { "port": 8098 }`.
- `ai/pb/pb_hooks/proxy.pb.js`: the route (committed — it's code, not a secret).
- `sync-backends.sh` provisions the instance + systemd unit + Caddyfile entry as for any backend. **One manual addition:** the systemd unit needs TWO env vars — `ANTHROPIC_PROXY_KEY=...` (the key) and `PROXY_POW_SECRET=...` (a random string for HMAC-signing PoW nonces) — set in a separate 0600 `.d/env.conf` drop-in on the server, NOT in the repo, NOT touched by the sync script (verified: systemd uses template + per-instance `.d/` drop-ins; the sync script writes only `port.conf`).
- Rotation: change the env value + `systemctl restart pocketbase@ai`. One place.
- The `ai.pb.gurum.se` health endpoint stays public (no key) so demos can do their usual health check.

---

## 6. What I can build vs. what only the owner can do

**Buildable by the agent (no secret):** the new backend entry in config, the `proxy.pb.js` hook (with env-var read), the abuse-control logic, the per-demo frontend hybrid branch, the budget counter, docs. All committable.

**Owner-only manual steps (the spec documents these; the agent never does them):**
1. Create the Anthropic workspace + key + $10 spend cap + model restriction + alerts.
2. Put the key in the server's systemd env (`ANTHROPIC_PROXY_KEY`), 0600, never in repo.
3. Restart `pocketbase@ai`.

Until those manual steps are done, the proxy returns a clean 503 ("live proxy not configured") and demos fall back to canned + BYO — so shipping the code is safe even before the key exists.

---

## 7. Verified against the live server (2026-06-07)

A throwaway PB 0.25.8 instance on the actual box confirmed the two load-bearing unknowns:
- ✅ **`$os.getenv` works** — returned a real env value. The key-from-env approach is sound.
- ✅ **`$http.send` works and forwards to Anthropic** — a probe with a deliberately-invalid key reached `api.anthropic.com/v1/messages` and relayed back a structured `401 invalid x-api-key` with the request_id. The dumb-forward (headers in, status+body out) is proven end-to-end. This was the one PB-version-sensitive piece.
- ✅ **systemd env injection** — units use a template + per-instance `.d/` drop-ins (`port.conf` written by `sync-backends.sh`). The key goes in a SEPARATE, manually-managed `.d/env.conf` (`Environment=ANTHROPIC_PROXY_KEY=...`, 0600) that coexists with and survives syncs — and stays out of the repo/script entirely. `sync-backends.sh` is NOT modified to carry the key.

Remaining minor choices (decide at plan time, low risk):
- **PB 0.25 built-in rate limiter vs. in-hook sliding window** for per-IP — prefer built-in if it cleanly covers custom routes; in-hook map is the fallback.
- **Budget counter store** — lean a tiny collection (survives restart, queryable) over a pb_data JSON file.

---

## 8. Verdict

Yes, the key can move server-side securely — but "securely" = key-in-env (trivial) + **abuse control on the endpoint** (the real work) + **Anthropic spend cap** (the backstop). One shared `ai.pb.gurum.se` proxy, dumb-forward (prompts stay client-side), hybrid key model (canned → proxied → BYO). Non-streaming demos make the forward simple. The agent builds everything except the key provisioning + spend cap, which are owner-only console/server steps the spec spells out.
