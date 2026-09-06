/* clinic-admin — Claude proxy client — PoW solve, live call (forced tool_use) + response
   validation, canned rule engine, source-mode state. NOT the tab UI (that is tabs/tab7-ai.js). */
import { Store } from "./store.js";
import { Masters } from "./masters.js";

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

// Schema-forced structured output: the proxy forwards tools/tool_choice to Bedrock, so the
// model returns a guaranteed-shape tool_use block — no regex over prose.
const ITEM_SCHEMA = {
  type: "object",
  properties: {
    code: { type: "string", description: "KOICD 표기(M54.5) 또는 행위코드. 예시 목록·마스터에 없는 코드는 넣지 말 것" },
    name: { type: "string", description: "한국어 표준 명칭" },
    conf: { type: "number", minimum: 0, maximum: 1 },
    ref:  { type: "string", description: "출처 약어 + 주의(예: 'KCD / 손상편', '행위 급여목록 · 추나 횟수 한도 주의')" }
  },
  required: ["code", "name", "conf", "ref"]
};
const RECOMMEND_TOOL = {
  name: "recommend_codes",
  description: "진료 메모에 맞는 상병(KCD)·한의 병증 U코드·행위(자보/건보 공통) 코드 초안",
  input_schema: {
    type: "object",
    properties: {
      kcd:    { type: "array", minItems: 1, maxItems: 3, items: ITEM_SCHEMA, description: "비U 상병 1~3개 (첫 항목 = 주상병)" },
      uCode:  { ...ITEM_SCHEMA, description: "한의 병증 U코드 정확히 1개 (U20–U33 또는 U50–U79). 항상 kcd의 주상병과 짝" },
      jabo:   { type: "array", minItems: 2, maxItems: 5, items: ITEM_SCHEMA, description: "행위 코드 2~5개 — 자보도 건강보험 행위 급여목록의 코드를 그대로 사용" },
      bigeup: { type: "array", minItems: 0, maxItems: 2, items: ITEM_SCHEMA, description: "비급여 0~2개. 교통사고(자보) 환자는 빈 배열" }
    },
    required: ["kcd", "uCode", "jabo", "bigeup"]
  }
};

// Canned exemplar — rule engine calibrated against the bundled 발췌. Codes carry
// "예시" refs: the U-code and 행위 codes are placeholders, not master-verified codes.
const cannedFor = (note) => {
  const isAccident = /사고|추돌|교통|충돌/.test(note);
  const isNeck = /경[부추]|목/.test(note);
  const isLumbar = /요[부추]|허리/.test(note);
  const isShoulder = /어깨|견[관통]/.test(note);
  const isHeadache = /두통|편두통/.test(note);

  const kcd = [];
  if (isLumbar && !isAccident) kcd.push({ code: "M54.5", name: "요통", conf: 0.92, ref: "KCD 발췌 / 근골격" });
  if (isLumbar && isAccident)  kcd.push({ code: "S33.5", name: "요추의 염좌 및 긴장", conf: 0.95, ref: "KCD 발췌 / 손상편" });
  if (isNeck && isAccident)    kcd.push({ code: "S13.4", name: "경추의 염좌 및 긴장", conf: 0.96, ref: "KCD 발췌 / 손상편" });
  if (isNeck && !isAccident)   kcd.push({ code: "M54.2", name: "경부통", conf: 0.88, ref: "KCD 발췌" });
  if (isShoulder)              kcd.push({ code: "M75.1", name: "회전근개증후군", conf: 0.78, ref: "KCD 발췌" });
  if (isHeadache)              kcd.push({ code: "G44.2", name: "긴장형 두통", conf: 0.82, ref: "KCD 발췌" });
  if (!kcd.length) kcd.push({ code: "M79.1", name: "근육통", conf: 0.55, ref: "KCD 발췌 / 일반 추정" });

  // 한의 병증 U코드 — structural example inside the U50–U79 block; the exact code is 예시.
  const uCode = isAccident
    ? { code: "U6x.x", name: "어혈(瘀血) 계열 병증 — 예시", conf: 0.60, ref: "예시 · 마스터(U50–U79)에서 확정" }
    : { code: "U6x.x", name: "기허(氣虛) 계열 병증 — 예시", conf: 0.55, ref: "예시 · 마스터(U50–U79)에서 확정" };

  const jabo = [];
  if (isAccident) {
    jabo.push({ code: "예시-01", name: "한방 초진 진찰료", conf: 0.90, ref: "행위 급여목록(예시) · 초·재진 구분" });
    jabo.push({ code: "예시-03", name: "경혈침술", conf: 0.95, ref: "행위 급여목록(예시) · 상병 부위 일치" });
    jabo.push({ code: "예시-10", name: "단순추나요법", conf: 0.85, ref: "행위 급여목록(예시) · 추나 횟수 한도" });
    jabo.push({ code: "예시-13", name: "약침술", conf: 0.78, ref: "행위 급여목록(예시) · 자보 급여 인정" });
  } else {
    jabo.push({ code: "예시-01", name: "한방 초진 진찰료", conf: 0.88, ref: "행위 급여목록(예시)" });
    jabo.push({ code: "예시-03", name: "경혈침술", conf: 0.82, ref: "행위 급여목록(예시)" });
  }

  // 비급여 is never recommended for accident (자보) patients.
  const bigeup = isAccident ? [] : [{ code: "BC0001", name: "약침술 — 경혈", conf: 0.65, ref: "HIRA 비급여(예시 발췌)" }];

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
  const kcd = rec.kcd.map(normItem).filter(Boolean).slice(0, 3);
  const uCode = normItem(rec.uCode);
  const jabo = (Array.isArray(rec.jabo) ? rec.jabo : []).map(normItem).filter(Boolean).slice(0, 5);
  const bigeup = (Array.isArray(rec.bigeup) ? rec.bigeup : []).map(normItem).filter(Boolean).slice(0, 2);
  if (!kcd.length || !uCode) return null;
  return { kcd, uCode, jabo, bigeup };
};

// One live call: PoW → POST (forced tool_use) → tool_use.input → validate. Throws exactly what
// the tab's catch block classifies (err.status for HTTP, err.code for shape, "pow-timeout", AbortError).
// When a clinic has uploaded real masters, the matching rows are appended to the system prompt.
async function requestRecommendation({ system, note, signal }) {
  const pow = await solveProxyPoW(signal);
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...pow },
    signal,
    body: JSON.stringify({
      model: "opus",
      max_tokens: 1500,
      system: system + Masters.contextFor(note),
      messages: [{ role: "user", content: `진료 메모:\n\n${note}\n\n위 메모에 맞는 상병(KCD)·한의 병증 U코드·행위 코드를 recommend_codes 도구로 제안해주세요.` }],
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: "tool", name: RECOMMEND_TOOL.name }
    })
  });
  if (!res.ok) { const e = new Error("proxy " + res.status); e.status = res.status; throw e; }
  const data = await res.json();
  if (data.stop_reason === "max_tokens") { const e = new Error("truncated"); e.code = "응답 잘림"; throw e; }
  const tu = (data.content || []).find(b => b.type === "tool_use" && b.name === RECOMMEND_TOOL.name);
  const rec = validateRec(tu?.input);
  if (!rec) { const e = new Error("unparseable"); e.code = "응답 형식"; throw e; }
  return rec;
}
export { CLAUDE_PROXY, solveProxyPoW, LIVE_ACK_KEY, RECOMMEND_TOOL, getAiSource, setAiSource, cannedFor, normItem, validateRec, requestRecommendation };
