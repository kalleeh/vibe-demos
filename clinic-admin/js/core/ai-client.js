/* clinic-admin — Claude proxy client — PoW solve, live call + response validation, canned rule engine, source-mode state. NOT the tab UI
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { Store } from "./store.js";

const CLAUDE_PROXY = "https://ai.pb.gurum.se";
async function solveProxyPoW(signal) {
  const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge", { signal });
  if (!r.ok) { const e = new Error("challenge " + r.status); e.status = r.status; throw e; }
  const { nonce, exp, sig, difficulty } = await r.json();
  const enc = new TextEncoder();
  const leadBits = (buf) => { const b = new Uint8Array(buf); let bits = 0;
    for (const x of b) { if (x === 0) { bits += 8; continue; } let v = x, c = 0; while ((v & 0x80) === 0) { c++; v <<= 1; } bits += c; break; } return bits; };
  for (let counter = 0; ; counter++) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const d = await crypto.subtle.digest("SHA-256", enc.encode(nonce + ":" + counter));
    if (leadBits(d) >= difficulty) return { "X-PoW-Nonce": nonce, "X-PoW-Exp": exp, "X-PoW-Sig": sig, "X-PoW-Counter": String(counter) };
    if (counter > 5000000) throw new Error("pow-timeout");
  }
}

// Source toggle state — 라이브 (default) POSTs the note to the proxy; 예시 never leaves the browser.
let aiSource = Store.get("ai.source") === "canned" ? "canned" : "live";
const LIVE_ACK_KEY = "ai.liveAck"; // one-time consent for sending notes off-device
function getAiSource() { return aiSource; }
function setAiSource(src) { aiSource = src; Store.set("ai.source", aiSource); }

// Canned exemplar — calibrated against KCD/자보/비급여 data files
const cannedFor = (note) => {
  const isAccident = /사고|추돌|교통|충돌/.test(note);
  const isNeck = /경[부추]|목/.test(note);
  const isLumbar = /요[부추]|허리/.test(note);
  const isShoulder = /어깨|견[관통]/.test(note);
  const isHeadache = /두통|편두통/.test(note);

  const kcd = [];
  if (isLumbar && !isAccident) kcd.push({ code: "M54.50", name: "요통(상세불명)", conf: 0.92, ref: "KCD-8 / 통계청 2021" });
  if (isLumbar && isAccident) kcd.push({ code: "S33.5", name: "요추의 염좌 및 긴장", conf: 0.95, ref: "KCD-8 / 손상편" });
  if (isNeck && isAccident)   kcd.push({ code: "S13.4", name: "경추의 염좌 및 긴장", conf: 0.96, ref: "KCD-8 / 손상편" });
  if (isNeck && !isAccident)  kcd.push({ code: "M54.2", name: "경부통", conf: 0.88, ref: "KCD-8" });
  if (isShoulder)             kcd.push({ code: "M75.1", name: "어깨 회전근개 증후군", conf: 0.78, ref: "KCD-8" });
  if (isHeadache)             kcd.push({ code: "G44.20", name: "긴장성 두통(만성)", conf: 0.82, ref: "KCD-8" });
  if (!kcd.length) kcd.push({ code: "M79.1", name: "근육통", conf: 0.55, ref: "KCD-8 / 일반 추정" });

  // U-code (한의 변증) suggestion
  const uCode = isAccident
    ? { code: "U68.4", name: "어혈(瘀血)", conf: 0.80, ref: "KCD-8 한의 변증 U편" }
    : { code: "U68.0", name: "노권상(勞倦傷)", conf: 0.62, ref: "KCD-8 한의 변증 U편" };

  const jabo = [];
  if (isAccident) {
    jabo.push({ code: "40031", name: "변증기술료 — 표준", conf: 0.92, ref: "자보수가 §40031" });
    jabo.push({ code: "41001", name: "체침술", conf: 0.95, ref: "자보수가 §41001" });
    jabo.push({ code: "47011", name: "추나요법 — 단순", conf: 0.85, ref: "자보수가 §47011" });
    jabo.push({ code: "40301", name: "약침술 — 일반 (경혈)", conf: 0.78, ref: "자보수가 §40301 · C047 횟수 제한 주의" });
  } else {
    jabo.push({ code: "40011", name: "한방 초진 진찰료", conf: 0.88, ref: "자보수가 §40011" });
    jabo.push({ code: "41001", name: "체침술", conf: 0.82, ref: "자보수가 §41001" });
  }

  const bigeup = isAccident
    ? [{ code: "BC0101", name: "추나요법 — 자율신경", conf: 0.70, ref: "HIRA 비급여" }]
    : [{ code: "BC0001", name: "약침술 — 경혈", conf: 0.65, ref: "HIRA 비급여" }];

  return { kcd, uCode, jabo, bigeup };
};

// Model output is untrusted: coerce each item to {code,name,ref,conf} with
// string/number types and length caps, or drop it.
const normItem = (x) => {
  if (!x || typeof x !== "object" || typeof x.code !== "string" || typeof x.name !== "string") return null;
  const conf = Number(x.conf);
  return {
    code: x.code.trim().slice(0, 20),
    name: x.name.trim().slice(0, 120),
    ref:  typeof x.ref === "string" ? x.ref.trim().slice(0, 160) : "",
    conf: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0
  };
};
const validateRec = (rec) => {
  if (!rec || typeof rec !== "object" || !Array.isArray(rec.kcd) || !rec.uCode) return null;
  const kcd = rec.kcd.map(normItem).filter(Boolean);
  const uCode = normItem(rec.uCode);
  const jabo = (Array.isArray(rec.jabo) ? rec.jabo : []).map(normItem).filter(Boolean);
  const bigeup = (Array.isArray(rec.bigeup) ? rec.bigeup : []).map(normItem).filter(Boolean);
  if (!kcd.length || !uCode) return null;
  return { kcd, uCode, jabo, bigeup };
};

// One live call: PoW → POST → parse → validate. Throws exactly what the tab's
// catch block classifies (err.status for HTTP, err.code for shape, "pow-timeout", AbortError).
async function requestRecommendation({ system, note, signal }) {
  const pow = await solveProxyPoW(signal);
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...pow },
    signal,
    body: JSON.stringify({
      model: "opus",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: `진료 메모:\n\n${note}\n\n위 메모에 맞는 KCD/자보/비급여 코드를 추천해주세요. JSON만 응답.` }]
    })
  });
  if (!res.ok) { const e = new Error("proxy " + res.status); e.status = res.status; throw e; }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed = null;
  try { parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null; } catch {}
  const rec = validateRec(parsed);
  if (!rec) { const e = new Error("unparseable"); e.code = "응답 형식"; throw e; }
  return rec;
}
export { CLAUDE_PROXY, solveProxyPoW, LIVE_ACK_KEY, getAiSource, setAiSource, cannedFor, normItem, validateRec, requestRecommendation };
