/* clinic-admin — data lifecycle: the processing register, retention purge, erasure, encrypted backup.
   Import position: files → lifecycle (imports store/attachments/session/files; nothing from tabs or shell).

   The REGISTRY is the single source for the "데이터 처리 현황" panel: every stored key / IndexedDB
   store with purpose, legal basis (PoC wording — a real 개인정보 처리방침 needs the DPO's text),
   encryption, retention and how items are counted. Anything stored under the namespace that is
   NOT listed here shows up as "미등록" in the panel so a new key cannot hide. */
import { Store, EventBus, ActivityLog, NS } from "../core/store.js";
import { Attachments } from "../core/attachments.js";
import { Session } from "./session.js";
import { encryptJSON, decryptJSON, isEnvelope } from "./crypto.js";
import { downloadText, POC_MARK } from "../core/files.js";

const DAY = 86400000;
const len = (v) => Array.isArray(v) ? v.length : (v && typeof v === "object") ? Object.keys(v).length : (v == null || v === "" ? 0 : 1);
const prefix = (p) => (k) => k.startsWith(p);
const exact = (x) => (k) => k === x;

const REGISTRY = [
  { id: "jabo.draft", match: prefix("jabo.draft."), label: "자보 케이스 초안", detail: "환자명·환자번호·접수번호·사고/진료일·행위 목록",
    purpose: "자보 청구·지급 정산표 작성 보조", basis: "자동차손해배상 보장법 §12의2 청구 자료 준비 · 개인정보보호법 §15①4 (계약 이행)",
    encrypted: true, retention: "새 케이스 시작 시 삭제", days: null },
  { id: "jabo.history", match: exact("jabo.history"), label: "자보 정산 기록", detail: "정산 요약 (환자명·번호 포함)",
    purpose: "보험사별 삭감 추세 집계 (대시보드)", basis: "동일 — 통계 목적, 최소 보존", encrypted: true, retention: "90일", days: 90,
    purge: (v, cutoff) => (Array.isArray(v) ? v.filter(h => (h.at || 0) >= cutoff) : v) },
  { id: "ai.draft", match: exact("ai.draft"), label: "AI 탭 진료 메모", detail: "자유 텍스트 (진료 메모)",
    purpose: "코드 추천 입력", basis: "보존하지 않음 — 전송 전 마스킹, 서버 미저장", encrypted: true, retention: "0일 (저장 안 함)", days: 0 },
  { id: "ai.settings", match: (k) => k.startsWith("ai.") && k !== "ai.draft", label: "AI 탭 설정", detail: "예시/라이브 선택",
    purpose: "화면 설정", basis: "—", encrypted: true, retention: "설정", days: null },
  { id: "activity", match: exact("activity"), label: "활동 기록 (감사 로그)", detail: "일시·사용자·역할·작업·가명 대상(****1234)",
    purpose: "누가 언제 무엇을 처리했는지 기록", basis: "개인정보보호법 §29 · 안전성 확보조치 기준 §8 접속기록 보관 (PoC: 브라우저 내 1년)",
    encrypted: true, retention: "1년 · 추가만 가능", days: 365, purge: (v, cutoff) => (Array.isArray(v) ? v.filter(e => (e.at || 0) >= cutoff) : v) },
  { id: "license.list", match: exact("license.list"), label: "직원 면허 명부", detail: "이름·역할·면허신고일·보수교육 마감",
    purpose: "면허신고 기한 관리", basis: "의료법 §25 면허신고 의무 이행 · 개인정보보호법 §15①2 (법령상 의무)", encrypted: true, retention: "직원 삭제 시까지", days: null },
  { id: "attachments", store: "IndexedDB", label: "면허증 사진", detail: "카메라 촬영 이미지 (data URL)",
    purpose: "면허신고일 OCR 확인", basis: "동일", encrypted: true, retention: "직원 삭제 시까지 · 고아 첨부는 잠금 해제 시 파기", days: null },
  { id: "intake-cards", match: exact("intake-cards"), label: "접수 보드 로컬 카드", detail: "고정 가상 환자명·메모·상태",
    purpose: "실시간 접수 현황 데모 (오프라인 사본)", basis: "데모 데이터 — 실명 입력 불가", encrypted: true, retention: "삭제 시까지", days: null },
  { id: "yearend", match: prefix("yearend."), label: "연말정산 기관 정보", detail: "사업자등록번호·의료기관명·증빙코드",
    purpose: "의료비 자료제출 파일 헤더", basis: "소득세법 §165 자료제출 준비", encrypted: true, retention: "수정 시까지", days: null },
  { id: "bigeup.profile", match: prefix("bigeup.profile."), label: "비급여 보고 기관 정보", detail: "요양기관기호·기관명·적용일",
    purpose: "HIRA 비급여 반기보고 헤더", basis: "의료법 §45의2 비급여 보고", encrypted: true, retention: "수정 시까지", days: null },
  { id: "bigeup.tariff", match: exact("bigeup.tariff"), label: "비급여 단가표", detail: "항목별 금액 (개인정보 아님)",
    purpose: "반기보고 파일 생성", basis: "의료법 §45의2", encrypted: false, retention: "수정 시까지", days: null },
  { id: "accred.checked", match: exact("accred.checked"), label: "인증평가 체크 상태", detail: "항목 ID → 체크 (개인정보 아님)",
    purpose: "인증 준비 진행률", basis: "의료법 §58 인증 준비", encrypted: false, retention: "초기화 시까지", days: null },
  { id: "kcd.lastSummary", match: exact("kcd.lastSummary"), label: "KCD 정비 최근 요약", detail: "건수만",
    purpose: "대시보드 이어하기", basis: "—", encrypted: false, retention: "다음 실행 시 대체", days: null },
  { id: "retention.lastAudit", match: exact("retention.lastAudit"), label: "보존 감사 최근 요약", detail: "건수만",
    purpose: "대시보드 이어하기", basis: "—", encrypted: false, retention: "다음 실행 시 대체", days: null },
  { id: "ui", match: prefix("ui."), label: "화면 설정", detail: "마지막 탭·안내 표시 여부",
    purpose: "UX", basis: "—", encrypted: false, retention: "설정", days: null },
  { id: "__ws", match: exact("__ws"), label: "워크스페이스 키링", detail: "사용자 이름·역할 (평문) · PIN으로 래핑된 마스터키 · salt · AI 동의",
    purpose: "접근 통제 (PIN 잠금)", basis: "개인정보보호법 §29 · 안전성 확보조치 기준 §5 접근권한", encrypted: "부분 (키는 래핑)", retention: "전체 파기 시까지", days: null },
  { id: "__internal", match: (k) => k.startsWith("__") && k !== "__ws", label: "내부 메타", detail: "마지막 저장 시각·키별 수정 시각",
    purpose: "동기화 표시·처리 현황", basis: "—", encrypted: false, retention: "설정", days: null }
];

async function inventory() {
  const keys = Store.keys();
  const rows = [];
  const seen = new Set();
  for (const r of REGISTRY) {
    if (r.store === "IndexedDB") {
      let st = { count: 0, lastAt: 0 };
      try { st = await Attachments.stats(); } catch {}
      rows.push({ ...r, keys: ["attachments"], count: st.count, lastModified: st.lastAt || null, present: st.count > 0 });
      continue;
    }
    const mine = keys.filter(r.match);
    mine.forEach(k => seen.add(k));
    let count = 0, last = null;
    for (const k of mine) {
      const v = Store.get(k);
      count += (r.id === "jabo.draft" || r.id === "yearend" || r.id === "bigeup.profile" || r.id === "ui" || r.id === "ai.settings") ? (v == null || v === "" ? 0 : 1) : len(v);
      const m = Store.mtime(k); if (m && (!last || m > last)) last = m;
    }
    rows.push({ ...r, keys: mine, count, lastModified: last, present: mine.length > 0 });
  }
  for (const k of keys) if (!seen.has(k)) rows.push({ id: k, label: `미등록 키 ${k}`, detail: "레지스트리에 없는 키", purpose: "?", basis: "?", encrypted: Store.isSensitive(k), retention: "?", keys: [k], count: len(Store.get(k)), lastModified: Store.mtime(k), present: true, unregistered: true });
  return rows;
}

/* Runs on every unlock. Returns counts per area; logs one audit entry if anything was purged. */
async function purgeExpired() {
  if (!Session.isUnlocked()) return null;
  const now = Date.now();
  const out = {};
  for (const r of REGISTRY) {
    if (r.days == null || r.store) continue;
    for (const k of Store.keys().filter(r.match)) {
      const v = Store.get(k);
      if (v == null) continue;
      if (r.days === 0) { Store.remove(k); out[r.id] = (out[r.id] || 0) + 1; continue; }
      if (!r.purge) continue;
      const kept = r.purge(v, now - r.days * DAY);
      const removed = len(v) - len(kept);
      if (removed > 0) { Store.set(k, kept); out[r.id] = (out[r.id] || 0) + removed; }
    }
  }
  // Orphan attachments: photos whose staff row no longer exists.
  try {
    const owners = new Set((Store.get("license.list", []) || []).map(l => l.id));
    const st = await Attachments.stats();
    const orphans = st.owners.filter(o => !owners.has(o));
    if (orphans.length) out.attachments = await Attachments.deleteByOwners(orphans);
  } catch {}
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (total) {
    const parts = Object.entries(out).map(([id, n]) => `${REGISTRY.find(r => r.id === id)?.label || id} ${n}건`).join(" · ");
    ActivityLog.add({ tag: "system", action: `보존기간 만료 자동 파기 — ${parts}`, meta: { silent: true } });
  }
  EventBus.emitLocal("lifecycle:purged", out);
  return out;
}

/* 선택 항목 파기 — registry ids. */
async function destroy(ids) {
  await Store.flush();
  let n = 0;
  for (const id of ids) {
    const r = REGISTRY.find(x => x.id === id);
    if (!r) continue;
    if (r.store === "IndexedDB") { await Attachments.clearAll(); n++; continue; }
    if (r.id === "__ws" || r.id === "__internal") continue; // only via 전체 파기
    for (const k of Store.keys().filter(r.match)) { Store.remove(k); n++; }
  }
  if (n) ActivityLog.add({ tag: "system", action: `선택 항목 파기 — ${ids.join(", ")}`, meta: { silent: true } });
  return n;
}

/* 전체 파기 — data + attachments + users + wrapped keys. Caller has already collected the typed "파기". */
async function destroyAll() {
  try { ActivityLog.add({ tag: "system", action: "전체 파기", meta: { silent: true } }); } catch {}
  await Store.wipeAll({ keepWorkspace: false });
  Session.destroy();
  try { localStorage.removeItem("vibe.clinic-admin.player-id"); } catch {}
}

/* ── Encrypted backup ─────────────────────────────────────────────────────────────
   { format, v, exportedAt, poc, keyring, sensitive: { key: envelope }, plain: envelope, attachments: [raw] }
   `sensitive` are the stored envelopes verbatim; `plain` is the non-sensitive keys bundled and
   encrypted too, so the file contains no readable app data at all. Decrypting needs any user's PIN. */
const BACKUP_FORMAT = "vibe.clinic-admin.backup";

async function exportBackup() {
  if (!Session.isUnlocked()) throw new Error("locked");
  await Store.flush();
  const sensitive = {}, plain = {};
  for (const k of Store.keys()) {
    if (k.startsWith("__")) continue;
    const raw = Store.raw(k);
    if (Store.isSensitive(k)) { if (isEnvelope(raw)) sensitive[k] = raw; }
    else plain[k] = raw;
  }
  const bk = {
    format: BACKUP_FORMAT, v: 1, exportedAt: new Date().toISOString(), poc: POC_MARK,
    keyring: Session.exportKeyring(),
    sensitive,
    plain: await encryptJSON(Session.key(), plain),
    attachments: await Attachments.exportRaw()
  };
  const json = JSON.stringify(bk);
  downloadText(json, `clinic-admin_backup_${new Date().toISOString().slice(0, 10)}.json`);
  ActivityLog.add({ tag: "system", action: `암호화 백업 내려받음 — 항목 ${Object.keys(sensitive).length + Object.keys(plain).length}, 첨부 ${bk.attachments.length}` });
  return bk;
}

function parseBackup(text) {
  let bk;
  try { bk = JSON.parse(text); } catch { throw new Error("JSON 파일이 아닙니다"); }
  if (!bk || bk.format !== BACKUP_FORMAT || bk.v !== 1 || !bk.keyring?.users?.length || !isEnvelope(bk.plain)) throw new Error("clinic-admin 백업 파일이 아닙니다");
  return bk;
}

/* Restore replaces everything in this profile. Throws on a wrong PIN before touching anything. */
async function restoreBackup(bk, userId, pin) {
  const key = await Session.unwrapFromKeyring(bk.keyring, userId, pin); // wrong PIN → throws here
  const plain = await decryptJSON(key, bk.plain);                       // proves the key matches the data
  Session.lock("restore");
  await Store.wipeAll({ keepWorkspace: false });
  for (const [k, env] of Object.entries(bk.sensitive || {})) if (isEnvelope(env)) localStorage.setItem(`${NS}.${k}`, JSON.stringify(env));
  for (const [k, v] of Object.entries(plain || {})) localStorage.setItem(`${NS}.${k}`, JSON.stringify(v));
  await Attachments.importRaw(bk.attachments || []);
  Session.importKeyring(bk.keyring);
  const user = bk.keyring.users.find(u => u.id === userId);
  Session.adopt(key, user);
  await Store.whenUnlocked();
  ActivityLog.add({ tag: "system", action: `백업 복원 — ${bk.exportedAt}` });
  return { keys: Object.keys(bk.sensitive || {}).length + Object.keys(plain || {}).length, attachments: (bk.attachments || []).length };
}

export { REGISTRY, inventory, purgeExpired, destroy, destroyAll, exportBackup, parseBackup, restoreBackup, BACKUP_FORMAT };
