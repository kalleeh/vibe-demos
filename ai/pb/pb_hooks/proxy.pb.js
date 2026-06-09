// ai/pb/pb_hooks/proxy.pb.js
// Translating Claude proxy → Amazon Bedrock. Auth via bearer token from env
// (AWS_BEARER_TOKEN_BEDROCK), set ONLY in the server 0600 systemd drop-in — never
// in this repo. Verified 2026-06-08: a bearer POST to bedrock-runtime/<id>/invoke
// returns native Claude JSON for opus-4-8 and sonnet-4-6 in eu-north-1.
//
// Anti-spam (NOT wallet — Bedrock access is unlimited): origin check + proof-of-work
// + per-IP rate limit. PoW uses plain SHA-256 on both sides ($security.sha256 here,
// Web Crypto in the browser) over the identical "nonce:counter" string.
//
// IMPORTANT PB JSVM CONSTRAINT (learned the hard way): each routerAdd handler runs
// in an ISOLATED scope — it CANNOT see file-scope `const`/`function` declarations
// (ReferenceError). So every helper + constant lives INSIDE each handler, and any
// cross-call state (rate window, used nonces) lives in $app.store(), not a module Map.

routerAdd("GET", "/api/claude-challenge", (e) => {
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const POW_TTL_MS = 2 * 60 * 1000;
  const POW_DIFFICULTY = 12;
  const originAllowed = (o) => !!o && ALLOWED_ORIGINS.some(a => o === a || o.indexOf(a) === 0);

  const secret = $os.getenv("PROXY_POW_SECRET") || "";
  if (!secret) return e.json(503, { error: "live proxy not configured" });
  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });

  const nonce = $security.randomString(24);
  const exp = String(Date.now() + POW_TTL_MS);
  const sig = $security.hs256(nonce + ":" + exp, secret);
  return e.json(200, { nonce: nonce, exp: exp, sig: sig, difficulty: POW_DIFFICULTY });
});

routerAdd("POST", "/api/claude", (e) => {
  // --- everything inline: handlers can't see file-scope decls in PB's JSVM ---
  const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
  const MAX_TOKENS_CEILING = 2048;
  const POW_DIFFICULTY = 12;
  const RATE_WINDOW_MS = 60 * 1000;
  const RATE_MAX = 8;
  const MODEL_MAP = {
    opus:   "eu.anthropic.claude-opus-4-8",
    sonnet: "eu.anthropic.claude-sonnet-4-6",
  };
  const originAllowed = (o) => !!o && ALLOWED_ORIGINS.some(a => o === a || o.indexOf(a) === 0);
  const leadingZeroBits = (hex) => {
    let bits = 0;
    for (let i = 0; i < hex.length; i++) {
      const n = parseInt(hex[i], 16);
      if (n === 0) { bits += 4; continue; }
      if (n < 2) bits += 3; else if (n < 4) bits += 2; else if (n < 8) bits += 1;
      break;
    }
    return bits;
  };

  const token = $os.getenv("AWS_BEARER_TOKEN_BEDROCK");
  const region = $os.getenv("AWS_REGION") || "eu-north-1";
  const secret = $os.getenv("PROXY_POW_SECRET") || "";
  if (!token || !secret) return e.json(503, { error: "live proxy not configured" });

  const h = e.request.header;

  // --- proof-of-work gate ---
  const pNonce = h.get("X-PoW-Nonce") || "", pExp = h.get("X-PoW-Exp") || "",
        pSig = h.get("X-PoW-Sig") || "", pCounter = h.get("X-PoW-Counter") || "";
  if (!$security.equal(pSig, $security.hs256(pNonce + ":" + pExp, secret))) {
    return e.json(403, { error: "bad challenge" });
  }
  const nowp = Date.now();
  if (!pExp || nowp > Number(pExp)) return e.json(403, { error: "challenge expired" });

  // replay guard: spent nonces in $app.store() (cross-call, concurrent-safe).
  // value = expiry ms; prune lazily.
  const spent = $app.store().get("pow_used") || {};
  for (const k in spent) { if (spent[k] < nowp) delete spent[k]; }
  if (spent[pNonce]) return e.json(403, { error: "challenge already used" });

  if (leadingZeroBits($security.sha256(pNonce + ":" + pCounter)) < POW_DIFFICULTY) {
    return e.json(403, { error: "insufficient proof-of-work" });
  }
  spent[pNonce] = Number(pExp);
  $app.store().set("pow_used", spent);

  // --- per-IP rate limit (Caddy forwards the client IP) ---
  const ip = (h.get("X-Forwarded-For") || "").split(",")[0].trim() || "unknown";
  const rl = $app.store().get("rate") || {};
  const recent = (rl[ip] || []).filter(t => nowp - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return e.json(429, { error: "rate limit — try again shortly" });
  recent.push(nowp); rl[ip] = recent;
  // prune empty/old ip buckets so the store doesn't grow unbounded
  for (const k in rl) { if (!rl[k].length || nowp - rl[k][rl[k].length - 1] > RATE_WINDOW_MS) delete rl[k]; }
  rl[ip] = recent;
  $app.store().set("rate", rl);

  // --- origin check ---
  const origin = h.get("Origin") || h.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });

  // --- read + validate body (requestInfo().body is the parsed JSON map in JSVM) ---
  let body;
  try { body = e.requestInfo().body || {}; } catch (err) { return e.json(400, { error: "bad body" }); }
  const logical = String(body.model || "");
  const modelId = MODEL_MAP[logical];
  if (!modelId) return e.json(400, { error: "unknown model" });
  if (body.stream === true) return e.json(400, { error: "streaming not supported" });
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return e.json(400, { error: "messages required" });
  }
  let maxTokens = Number(body.max_tokens || 0);
  if (!maxTokens || maxTokens > MAX_TOKENS_CEILING) maxTokens = Math.min(maxTokens || 1024, MAX_TOKENS_CEILING);

  // --- translate to Bedrock invoke shape (model in path; anthropic_version in body) ---
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
    return e.json(res.statusCode || 200, res.json);
  } catch (err) {
    return e.json(502, { error: "upstream request failed" });
  }
});
