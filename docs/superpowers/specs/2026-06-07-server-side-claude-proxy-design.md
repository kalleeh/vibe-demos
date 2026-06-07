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

Moving the key server-side does not remove risk — it **changes its shape**, from "don't leak a key" to "don't let strangers drain the account." A proxy that calls Claude with the owner's key is by default a public "spend my money" button; PocketBase collection rules do NOT protect custom `pb_hooks` routes, so the route is reachable by anyone who finds the URL.

"Securely" therefore means four layers, not one:

| Layer | Where | Effort | Role |
|---|---|---|---|
| 1. Key in systemd `Environment=`, never in repo/frontend/logs | server | trivial | hides the key (the literal ask) |
| 2. Abuse control: per-IP rate limit + global daily cap + origin check | hook | **the real work** | stops a leaked URL from draining the account |
| 3. Anthropic-side spend cap ($10/mo) + model allow-list | console | trivial (manual) | the hard backstop when 1–2 fail |
| 4. ~~Streaming passthrough~~ | — | n/a | **eliminated** — demos are non-streaming |

Layer 1 alone is NOT "secure" — it just relocates risk. Layers 2 + 3 are what make it safe. Decided abuse posture: **layered + generous** (casual viewers never hit limits; scripted abuse stops fast).

---

## 3. Architecture — one shared AI-proxy backend

### 3.1 Topology (decided)

A single new PocketBase instance dedicated to the proxy: **`ai.pb.gurum.se`, port 8098** (next free; 8091–8097 are taken). All four AI demos call this one endpoint. Rationale: one key to rotate, one rate-limiter, one config — vs. per-demo hooks (4 keys/configs to drift) which buy nothing for a dumb proxy. (This is the same "shared backend beats per-demo" lesson the cross-demo `users` problem surfaced.)

> Note: this instance does NOT need any collections for the proxy itself — the hook route is independent of collections. (It MAY later also host a shared `users` collection if the deferred login work wants one, but that's out of scope here.)

### 3.2 The proxy route (`pb_hooks`)

PocketBase 0.25.8 supports `pb_hooks/*.pb.js` custom routes via the JSVM. Add `ai/pb/pb_hooks/proxy.pb.js` registering `POST /api/claude`:

- Reads the owner key from env: `$os.getenv("ANTHROPIC_PROXY_KEY")`.
- **Origin check:** reject unless `Origin`/`Referer` is `https://kalleeh.github.io` (and `http://localhost*` for local dev). Soft control (spoofable by non-browsers) but stops casual hotlinking.
- **Model allow-list:** reject any `model` not in `{claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5}` (mirrors the BYO UI toggle; blocks a leaker pivoting to something wilder).
- **Body shape guard:** require `max_tokens <= 2048`, `messages` array present, reject `stream: true` (non-streaming only).
- **Dumb forward:** inject `x-api-key` + `anthropic-version`, forward the (validated) body to `https://api.anthropic.com/v1/messages` via `$http.send`, return Anthropic's JSON response and status straight back.
- **Never log** the key, the full prompt, or the response body. Log only: timestamp, IP hash, model, token count, allow/deny reason.

### 3.3 Abuse control (Layer 2 — layered + generous)

Three gates in the hook, in order (cheapest first):
1. **Origin check** (above) — instant reject of non-allowed origins.
2. **Per-IP rate limit:** ~10 calls / 60s per client IP. Use PocketBase 0.25's built-in rate limiter (Settings → enable, configure a rule for the `/api/claude` route) if it cleanly covers custom routes; otherwise an in-hook sliding-window keyed by IP in a small in-memory map (acceptable for a single instance — note it resets on restart). Decide at implementation; prefer the built-in.
3. **Global daily budget:** a simple persisted counter (a single-row collection `proxy_budget { day (text YYYY-MM-DD), calls (number) }`, or a JSON file in pb_data) incremented per call; reject with 429 + a friendly "daily demo budget reached — paste your own key for unlimited" once over a configured ceiling (e.g. 500 calls/day). This is the wallet protector independent of any single IP.

IP for rate-limiting comes from Caddy's `X-Forwarded-For` (Caddy is the TLS terminator). The hook must read the forwarded IP, not the proxy's localhost.

### 3.4 Anthropic-side backstop (Layer 3 — manual, owner-only)

These are **console steps the owner performs; never automated, never in the repo:**
- Dedicated workspace + a per-key **monthly spend cap ($10)**.
- Restrict the key to the three allow-listed models.
- Email alerts at $1 / $3 / $5.
- The key value is set ONLY in the server's systemd unit `Environment=ANTHROPIC_PROXY_KEY=...` (or an `EnvironmentFile=` with 0600 perms), never committed, never echoed.

---

## 4. Frontend changes — hybrid key model (decided)

Each of the four demos keeps its three-state flow, matching the repo's "canned-first, live-optional" ethos:

1. **Canned mode (default)** — unchanged; no calls, no key.
2. **"Try it live" (new)** — calls the proxy `https://ai.pb.gurum.se/api/claude` with the same body shape used today, MINUS the key (the proxy injects it). Rate-limited/budgeted. On 429 (budget/rate hit) → a calm message: "demo's live budget is maxed for now — paste your own key below for unlimited," falling back to canned + the BYO panel.
3. **"Use my own key" (existing)** — unchanged; unlimited, on the viewer's dime, calls `api.anthropic.com` directly with their key. Still the power-user path.

Implementation shape per demo: a small branch in the existing `callClaude()` — if the viewer has pasted a key, use the direct path (existing code); else use the proxy path (new fetch to `ai.pb.gurum.se`, no key header). Local-first/canned fallback on any error or 429. The per-demo `vibe.<slug>.key` localStorage stays for the BYO path.

**Privacy note (clinic-admin):** clinic-admin's promise is patient data never leaves the browser. The proxy sees whatever the demo sends to Claude today — which is already canned/example data in the demo, not real PII. The proxy does not change what's sent; it just swaps who holds the key. Keep the demo's example-only inputs; do not start sending real patient text through the proxy.

---

## 5. Deploy & ops

- `backends/config.json`: add `"ai": { "port": 8098 }`.
- `ai/pb/pb_hooks/proxy.pb.js`: the route (committed — it's code, not a secret).
- `sync-backends.sh` provisions the instance + systemd unit + Caddyfile entry as for any backend. **One manual addition:** the systemd unit needs `Environment=ANTHROPIC_PROXY_KEY=...` — done out-of-band on the server (or via an `EnvironmentFile`), NOT in the repo. The sync script may need a documented hook for per-backend env (or a manual `systemctl edit pocketbase@ai` override) — confirm at implementation.
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

## 7. Open questions (resolve at plan/implementation)

- **PB 0.25 built-in rate limiter vs. in-hook sliding window** for per-IP — prefer built-in if it covers custom routes; verify against 0.25.8.
- **Budget counter store** — tiny collection vs. pb_data JSON file. Lean collection (survives restart, queryable).
- **`$http.send` in PB 0.25.8 JSVM** — confirm the exact API (timeout, header passing, response shape) before writing the forward; it's the one PB-version-sensitive piece.
- **sync-backends.sh env injection** — does it support per-backend env, or is a manual systemd override the path? Confirm before claiming the deploy is one-command.

---

## 8. Verdict

Yes, the key can move server-side securely — but "securely" = key-in-env (trivial) + **abuse control on the endpoint** (the real work) + **Anthropic spend cap** (the backstop). One shared `ai.pb.gurum.se` proxy, dumb-forward (prompts stay client-side), hybrid key model (canned → proxied → BYO). Non-streaming demos make the forward simple. The agent builds everything except the key provisioning + spend cap, which are owner-only console/server steps the spec spells out.
