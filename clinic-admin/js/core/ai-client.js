/* clinic-admin — Claude proxy client — PoW solve, live call (forced tool_use) + response
   validation, canned rule engine, source-mode state. NOT the tab UI (that is tabs/tab7-ai.js). */
import { Store } from "./store.js";
import { Masters } from "./masters.js";
import { t } from "./i18n.js";

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
  description: "진료 메모에 맞는 상병(KCD)·한의 병증 U코드·행위(자보/건보 공통)·비급여 코드 초안",
  input_schema: {
    type: "object",
    properties: {
      kcd:    { type: "array", minItems: 1, maxItems: 3, items: ITEM_SCHEMA, description: "비U 상병 1~3개 (첫 항목 = 주상병)" },
      uCode:  { ...ITEM_SCHEMA, description: "한의 병증 U코드 정확히 1개 (U20–U33 또는 U50–U79). 항상 kcd의 주상병과 짝" },
      jabo:   { type: "array", minItems: 2, maxItems: 5, items: ITEM_SCHEMA, description: "행위 코드 2~5개 — 자보도 건강보험 행위 급여목록의 코드를 그대로 사용 (행위 예시 목록의 '예시-NN')" },
      bigeup: { type: "array", minItems: 0, maxItems: 2, items: ITEM_SCHEMA, description: "비급여 0~2개 — 비급여 예시 목록(data/bigeup.json과 같은 '예시-NN')의 코드만. 교통사고(자보) 환자는 빈 배열" }
    },
    required: ["kcd", "uCode", "jabo", "bigeup"]
  }
};

// Canned exemplar — rule engine calibrated against the bundled 발췌/예시. Codes carry
// "예시" refs: the U-code, 행위 and 비급여 codes are placeholders, not master-verified codes.
// Cues come from Korean clinical words AND from codes already in the note (02/01/06 hand-offs prefill codes).
const cannedFor = (note) => {
  const n = String(note || "");
  const isAccident = /사고|추돌|교통|충돌|자보|S13|S33|S43|minor_4wk|4주/.test(n);
  const isNeck = /경[부추]|목|S13/.test(n);
  const isLumbar = /요[부추]|허리|S33|M54\.?5|M54\.?4/.test(n);
  const isShoulder = /어깨|견[관통]|M75|S43/.test(n);
  const isHeadache = /두통|편두통|G44|G43/.test(n);
  const isKnee = /무릎|슬관절|M17/.test(n);
  const isFollowUp = /재진|경과|회차|재방문/.test(n);

  const kcd = [];
  if (isLumbar && !isAccident) kcd.push({ code: "M54.5", name: "요통", conf: 0.92, ref: "KCD 발췌 / 근골격" });
  if (isNeck && isAccident)    kcd.push({ code: "S13.4", name: "경추의 염좌 및 긴장", conf: 0.96, ref: "KCD 발췌 / 손상편" });
  if (isLumbar && isAccident)  kcd.push({ code: "S33.5", name: "요추의 염좌 및 긴장", conf: 0.95, ref: "KCD 발췌 / 손상편" });
  if (isNeck && !isAccident)   kcd.push({ code: "M54.2", name: "경부통", conf: 0.88, ref: "KCD 발췌" });
  if (isShoulder && !isAccident) kcd.push({ code: "M75.1", name: "회전근개증후군", conf: 0.78, ref: "KCD 발췌" });
  if (isShoulder && isAccident)  kcd.push({ code: "S43.4", name: "어깨관절의 염좌 및 긴장", conf: 0.80, ref: "KCD 발췌 / 손상편" });
  if (isHeadache)              kcd.push({ code: "G44.2", name: "긴장형 두통", conf: 0.82, ref: "KCD 발췌 / 신경" });
  if (isKnee)                  kcd.push({ code: "M25.5", name: "관절통", conf: 0.60, ref: "KCD 발췌 · M17.1은 발췌 미수록 — 마스터 확인" });
  if (!kcd.length) kcd.push({ code: "M79.1", name: "근육통", conf: 0.55, ref: "KCD 발췌 / 일반 추정" });

  // 한의 병증 U코드 — structural example inside the U50–U79 block; the exact code is 예시.
  const uCode = isAccident
    ? { code: "U6x.x", name: "어혈(瘀血) 계열 병증 — 예시", conf: 0.60, ref: "예시 · 마스터(U50–U79)에서 확정" }
    : { code: "U6x.x", name: "기허(氣虛) 계열 병증 — 예시", conf: 0.55, ref: "예시 · 마스터(U50–U79)에서 확정" };

  const jabo = [];
  jabo.push(isFollowUp ? { code: "예시-02", name: "한방 재진 진찰료", conf: 0.90, ref: "행위 급여목록(예시) · 재진" }
                       : { code: "예시-01", name: "한방 초진 진찰료", conf: 0.90, ref: "행위 급여목록(예시) · 초·재진 구분" });
  jabo.push({ code: "예시-03", name: "경혈침술", conf: 0.95, ref: isAccident ? "행위 급여목록(예시) · 상병 부위 일치" : "행위 급여목록(예시)" });
  if (isAccident) {
    jabo.push({ code: "예시-10", name: "단순추나요법", conf: 0.85, ref: "행위 급여목록(예시) · 추나 횟수 한도" });
    jabo.push({ code: "예시-13", name: "약침술", conf: 0.78, ref: "행위 급여목록(예시) · 자보 급여 인정 · 상병 부위와 시술 부위 일치" });
  } else if (isKnee) {
    jabo.push({ code: "예시-04", name: "전기침술", conf: 0.80, ref: "행위 급여목록(예시)" });
    jabo.push({ code: "예시-16", name: "첩약 (1일분)", conf: 0.70, ref: "행위 급여목록(예시) · 첩약 처방일수 한도" });
  } else {
    jabo.push({ code: "예시-08", name: "건식부항", conf: 0.75, ref: "행위 급여목록(예시) · 동일부위 중복 주의" });
  }

  // 비급여 is never recommended for accident (자보) patients. Codes = data/bigeup.json 예시 items.
  const bigeup = isAccident ? [] : [{ code: "예시-01", name: "약침술 — 경혈", conf: 0.65, ref: "HIRA 비급여 예시 · 04 탭 단가표" }];

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
// `system` already carries the Org block (tabs/tab7-prompt.js buildSystemPrompt); uploaded masters and the
// clinic's 비급여 단가표 (`tariff` rows {code, name, price}) are appended here through Masters.contextFor.
async function requestRecommendation({ system, note, signal, tariff = [] }) {
  const pow = await solveProxyPoW(signal);
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...pow },
    signal,
    body: JSON.stringify({
      model: "opus",
      max_tokens: 1500,
      system: system + Masters.contextFor(note, { tariff }),
      messages: [{ role: "user", content: `진료 메모:\n\n${note}\n\n위 메모에 맞는 상병(KCD)·한의 병증 U코드·행위 코드를 recommend_codes 도구로 제안해주세요.` }],
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: "tool", name: RECOMMEND_TOOL.name }
    })
  });
  if (!res.ok) { const e = new Error("proxy " + res.status); e.status = res.status; throw e; }
  const data = await res.json();
  if (data.stop_reason === "max_tokens") { const e = new Error("truncated"); e.code = t("ai.errTruncated"); throw e; }
  const tu = (data.content || []).find(b => b.type === "tool_use" && b.name === RECOMMEND_TOOL.name);
  const rec = validateRec(tu?.input);
  if (!rec) { const e = new Error("unparseable"); e.code = t("ai.errShape"); throw e; }
  return rec;
}
export { CLAUDE_PROXY, solveProxyPoW, RECOMMEND_TOOL, getAiSource, setAiSource, cannedFor, normItem, validateRec, requestRecommendation };
