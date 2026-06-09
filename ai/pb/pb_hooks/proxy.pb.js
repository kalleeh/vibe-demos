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
// JSVM APIs confirmed via Context7 (/websites/pocketbase_io_jsvm, 2026-06-08):
//   $http.send -> {statusCode, json, raw}; $os.getenv; $security.sha256 (hex),
//   $security.hs256(text,secret) (hex HMAC), $security.randomString, $security.equal
//   (constant-time); e.bindBody(obj); e.request.header.get(name); routerAdd.

const ALLOWED_ORIGINS = ["https://kalleeh.github.io", "http://localhost", "http://127.0.0.1"];
const MAX_TOKENS_CEILING = 2048;

// Logical model -> Bedrock inference-profile id. Server-side so model ids can
// change without a frontend deploy and callers can't request arbitrary models.
const MODEL_MAP = {
  opus:   "eu.anthropic.claude-opus-4-8",
  sonnet: "eu.anthropic.claude-sonnet-4-6",
};

// --- proof-of-work + rate-limit config ---
const POW_DIFFICULTY = 16;             // leading zero BITS; tuned so a phone solves ~150-300ms
const POW_TTL_MS = 2 * 60 * 1000;      // a challenge is valid 2 minutes
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;                    // per-IP calls per window
const ipHits = new Map();              // ip -> [timestamps]  (in-memory; resets on restart)
const usedNonces = new Map();          // nonce -> exp ms     (replay guard)

function originAllowed(o) {
  if (!o) return false;
  return ALLOWED_ORIGINS.some(a => o === a || o.indexOf(a) === 0);
}
function powSecret() { return $os.getenv("PROXY_POW_SECRET") || ""; }

// Count leading zero BITS of a hex string.
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

// Issue a signed PoW challenge. sig binds nonce+exp to our secret so it can't be
// forged; the client never sees the secret.
routerAdd("GET", "/api/claude-challenge", (e) => {
  const secret = powSecret();
  if (!secret) return e.json(503, { error: "live proxy not configured" });
  const origin = e.request.header.get("Origin") || e.request.header.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });
  const nonce = $security.randomString(24);
  const exp = String(Date.now() + POW_TTL_MS);
  const sig = $security.hs256(nonce + ":" + exp, secret);
  return e.json(200, { nonce: nonce, exp: exp, sig: sig, difficulty: POW_DIFFICULTY });
});

routerAdd("POST", "/api/claude", (e) => {
  const token = $os.getenv("AWS_BEARER_TOKEN_BEDROCK");
  const region = $os.getenv("AWS_REGION") || "eu-north-1";
  const secret = powSecret();
  if (!token || !secret) return e.json(503, { error: "live proxy not configured" });

  const h = e.request.header;

  // --- proof-of-work gate (cheapest valid-reject after the config gate) ---
  const pNonce = h.get("X-PoW-Nonce") || "", pExp = h.get("X-PoW-Exp") || "",
        pSig = h.get("X-PoW-Sig") || "", pCounter = h.get("X-PoW-Counter") || "";
  if (!$security.equal(pSig, $security.hs256(pNonce + ":" + pExp, secret))) {
    return e.json(403, { error: "bad challenge" });
  }
  if (!pExp || Date.now() > Number(pExp)) return e.json(403, { error: "challenge expired" });
  const nowp = Date.now();
  for (const [k, v] of usedNonces) { if (v < nowp) usedNonces.delete(k); }
  if (usedNonces.has(pNonce)) return e.json(403, { error: "challenge already used" });
  if (leadingZeroBits($security.sha256(pNonce + ":" + pCounter)) < POW_DIFFICULTY) {
    return e.json(403, { error: "insufficient proof-of-work" });
  }
  usedNonces.set(pNonce, Number(pExp));

  // --- per-IP rate limit (Caddy forwards the client IP) ---
  const ip = (h.get("X-Forwarded-For") || "").split(",")[0].trim() || "unknown";
  const arr = (ipHits.get(ip) || []).filter(t => nowp - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return e.json(429, { error: "rate limit — try again shortly" });
  arr.push(nowp); ipHits.set(ip, arr);

  // --- origin check ---
  const origin = h.get("Origin") || h.get("Referer") || "";
  if (!originAllowed(origin)) return e.json(403, { error: "origin not allowed" });

  // --- read + validate body ---
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
    // res.json = parsed Bedrock response (native Claude shape). Relay verbatim.
    // Never log token/prompt/response.
    return e.json(res.statusCode || 200, res.json);
  } catch (err) {
    return e.json(502, { error: "upstream request failed" });
  }
});
