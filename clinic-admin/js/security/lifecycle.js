/* clinic-admin — data lifecycle: the processing register, retention purge, erasure, encrypted backup.
   Import position: files → lifecycle (imports store/attachments/session/files; nothing from tabs or shell).

   The REGISTRY is the single source for the "데이터 처리 현황" panel: every stored key / IndexedDB
   store with purpose, legal basis (PoC wording — a real 개인정보 처리방침 needs the DPO's text),
   encryption, retention and how items are counted. Anything stored under the namespace that is
   NOT listed here shows up as "미등록" in the panel so a new key cannot hide. */
import { Store, EventBus, ActivityLog, NS, SENSITIVE_KEYS } from "../core/store.js";
import { Attachments } from "../core/attachments.js";
import { Session } from "./session.js";
import { Cloud } from "./cloud.js";
import { encryptJSON, decryptJSON, isEnvelope, importSessionKey, unwrapMaster } from "./crypto.js";
import { downloadText, POC_MARK } from "../core/files.js";
import { Masters } from "../core/masters.js";
import { Staff } from "../core/entities.js";
import { t, tOr } from "../core/i18n.js";

const DAY = 86400000;
// Registry rows keep their Korean text as the source of truth; loc() swaps the five user-facing fields for the
// lifecycle.reg.<id>.* keys of the active language (falls back to the Korean field when a key is absent).
const loc = (r) => ({
  ...r,
  label: tOr(`lifecycle.reg.${r.id}.label`, r.label), detail: tOr(`lifecycle.reg.${r.id}.detail`, r.detail),
  purpose: tOr(`lifecycle.reg.${r.id}.purpose`, r.purpose), basis: tOr(`lifecycle.reg.${r.id}.basis`, r.basis),
  retention: tOr(`lifecycle.reg.${r.id}.retention`, r.retention),
  encrypted: typeof r.encrypted === "string" ? tOr(`lifecycle.reg.${r.id}.encrypted`, r.encrypted) : r.encrypted
});
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
  { id: "ai.draft", match: exact("ai.draft"), label: "AI 어시스트 진료 메모", detail: "자유 텍스트 (진료 메모)",
    purpose: "코드 추천 입력", basis: "보존하지 않음 — 전송 전 마스킹, 서버 미저장", encrypted: true, retention: "0일 (저장 안 함)", days: 0 },
  { id: "ai.settings", match: (k) => k.startsWith("ai.") && k !== "ai.draft", label: "AI 어시스트 설정", detail: "예시/라이브 선택",
    purpose: "화면 설정", basis: "—", encrypted: true, retention: "설정", days: null },
  { id: "activity", match: exact("activity"), label: "활동 기록 (감사 로그)", detail: "일시·사용자·역할·작업·가명 대상(****1234)",
    purpose: "누가 언제 무엇을 처리했는지 기록", basis: "개인정보보호법 §29 · 안전성 확보조치 기준 §8 접속기록 보관 (PoC: 브라우저 내 1년)",
    encrypted: true, retention: "1년 · 추가만 가능", days: 365, purge: (v, cutoff) => (Array.isArray(v) ? v.filter(e => (e.at || 0) >= cutoff) : v) },
  /* ── shared entities (core/entities.js) ── */
  { id: "org.profile", match: exact("org.profile"), label: "기관 프로필", detail: "기관명·요양기관기호·사업자등록번호·종별·대표자 (기관 정보 — 개인정보 아님)",
    purpose: "보고·제출 파일 헤더 · 화면 표시", basis: "의료법 §45의2 · 소득세법 §165 자료제출 준비", encrypted: false, retention: "수정 시까지", days: null },
  { id: "staff.list", match: exact("staff.list"), label: "직원 명부 (면허·로그인)", detail: "이름·직종·면허번호·취득일·면허신고일·보수교육 마감·로그인 연결",
    purpose: "면허신고 기한 관리 · 사용자 계정 연결", basis: "의료법 §25 면허신고 의무 이행 · 개인정보보호법 §15①2 (법령상 의무)", encrypted: true, retention: "직원 삭제 시까지", days: null },
  { id: "patients.register", match: exact("patients.register"), label: "가명 환자 대장", detail: "환자번호(가명)·태그·첫/마지막 진료일 — 이름·주민번호 없음",
    purpose: "탭 간 동일 환자 참조 (****0142)", basis: "가명처리 · 개인정보보호법 §28의2", encrypted: true, retention: "삭제 시까지", days: null },
  { id: "claims.batch", match: prefix("claims.batch."), label: "업로드 배치", detail: "업로드 파일에서 파싱한 행 (명세서·환자번호·일자·코드) — 청구·심사·정비·연말정산·보존",
    purpose: "탭 간 재사용·대조 (업로드 1회, 여러 탭에서 참조)", basis: "자동차손해배상 보장법 §12의2 · 개인정보보호법 §15①4 (계약 이행)", encrypted: true, retention: "90일 · 최대 20건", days: 90,
    purge: (v, cutoff) => ((v?.createdAt || 0) >= cutoff ? v : null) },
  // tariff.items + tariff.effectiveDate only — tariff.history is its own row (registered by tab4-bigeup.js), not double-listed here.
  { id: "tariff", match: (k) => k === "tariff.items" || k === "tariff.effectiveDate", label: "비급여 단가표 · 적용일", detail: "항목별 금액·빈도, 적용일 (개인정보 아님)",
    purpose: "반기보고 파일 생성", basis: "의료법 §45의2", encrypted: false, retention: "수정 시까지", days: null },
  { id: "insurers.lastUsed", match: exact("insurers.lastUsed"), label: "최근 보험사", detail: "마지막으로 선택한 보험사명 (개인정보 아님)",
    purpose: "자보 탭 기본값", basis: "—", encrypted: false, retention: "설정", days: null },
  { id: "attachments", store: "IndexedDB", label: "면허증 사진", detail: "카메라 촬영 이미지 (data URL)",
    purpose: "면허신고일 OCR 확인", basis: "동일", encrypted: true, retention: "직원 삭제 시까지 · 고아 첨부는 잠금 해제 시 파기", days: null },
  { id: "intake-cards", match: exact("intake-cards"), label: "접수 보드 로컬 카드", detail: "고정 가상 환자명·메모·상태",
    purpose: "실시간 접수 현황 데모 (오프라인 사본)", basis: "데모 데이터 — 실명 입력 불가", encrypted: true, retention: "삭제 시까지", days: null },
  { id: "player-id", match: exact("player-id"), label: "접수 보드 기기 식별자", detail: "무작위 UUID — 「내가 추가」 표시용 (개인정보 아님)",
    purpose: "공유 보드에서 이 기기가 올린 카드 표시", basis: "—", encrypted: false, retention: "전체 파기 시까지", days: null },
  { id: "masters", store: "IndexedDB (masters)", label: "업로드 마스터 (KOICD 상병 · 심평원 행위·수가)", detail: "공개 참조표 (개인정보 아님)",
    purpose: "정비·정산·검색·AI 탭의 대조 기준", basis: "—", encrypted: false, retention: "「업로드본 지우기」 또는 전체 파기 시까지", days: null },
  // 기관 정보 moved to org.profile (migrated on unlock); what is left under yearend.* is the tab's tax-year setting.
  { id: "yearend", match: prefix("yearend."), label: "연말정산 설정", detail: "과세연도 (기관 정보는 「기관 프로필」로 이전)",
    purpose: "의료비 자료 사전점검 기준 연도", basis: "—", encrypted: true, retention: "수정 시까지", days: null },
  { id: "accred.checked", match: exact("accred.checked"), label: "인증평가 체크 상태", detail: "항목 ID → 체크 (개인정보 아님)",
    purpose: "인증 준비 진행률", basis: "의료법 §58 인증 준비", encrypted: false, retention: "초기화 시까지", days: null },
  { id: "kcd.lastSummary", match: exact("kcd.lastSummary"), label: "KCD 정비 최근 요약", detail: "건수 · 미수록 코드 · 청구 배치 id (개인정보 아님)",
    purpose: "대시보드 이어하기", basis: "—", encrypted: false, retention: "다음 실행 시 대체", days: null },
  { id: "retention.lastAudit", match: exact("retention.lastAudit"), label: "보존 감사 최근 요약", detail: "건수만",
    purpose: "대시보드 이어하기", basis: "—", encrypted: false, retention: "다음 실행 시 대체", days: null },
  { id: "ui", match: prefix("ui."), label: "화면 설정", detail: "마지막 탭·안내 표시 여부·언어·현재 청구 배치 id",
    purpose: "UX", basis: "—", encrypted: false, retention: "설정", days: null },
  { id: "__lock", match: exact("__lock"), label: "잠금 설정 (이 기기)", detail: "자동 잠금·세션 길이 · 사용자 id별 PIN 오류 백오프 · AI 동의 (이름 없음 — 사용자·키는 서버)",
    purpose: "접근 통제 (PIN 잠금) 설정", basis: "개인정보보호법 §29 · 안전성 확보조치 기준 §5 접근권한", encrypted: false, retention: "전체 파기 시까지", days: null },
  // The session record (security/session.js): a NON-extractable AES-GCM CryptoKey + user id + timestamps + a SEALED blob
  // (name · role · server token · my wrapped key · directory snapshot, AES-GCM under that very key). It is what lets a reload
  // resume without the PIN. Removed by lock / expiry / 전체 파기 — not destroyable from the table.
  { id: "session", store: "IndexedDB (session)", label: "세션 키 (추출 불가 CryptoKey)", detail: "잠금 해제 상태를 이어가는 세션 키 · 사용자 id · 해제/만료/최근 활동 시각 · 세션 키로 봉인한 서버 토큰·이름·역할 (키는 내보낼 수 없음)",
    purpose: "새로 고침·탭 재열기 후 PIN 없이 이어가기 (세션 길이·무활동 시간 안에서만)", basis: "안전성 확보조치 기준 §5 — 세션 관리 · 무활동 시 자동 잠금", encrypted: "추출 불가 CryptoKey", retention: "만료 시 삭제 · 잠금 시 삭제", days: null },
  /* ── the server side (js/security/cloud.js · pb/pb_migrations/005_cloud_identity.js) — listed so the register is complete ── */
  { id: "cloud.directory", server: true, store: "서버 workspace.directory", label: "서버 사용자 디렉터리 (이름·역할, 공개 읽기 — PoC)", detail: "로그인 id · 이름 · 시스템 역할 · 명부 행 id — 로그인 전 드롭다운을 위해 URL을 아는 누구나 읽을 수 있음",
    purpose: "모든 기기에서 같은 사용자 목록으로 잠금 해제", basis: "안전성 확보조치 기준 §5 접근권한 (PoC: 공개 읽기 — 실사용 시 인증 뒤로)", encrypted: false, retention: "원장이 로그인 해제할 때까지", days: null },
  { id: "cloud.password", server: true, store: "서버 staff_users · staff_keys", label: "PIN 파생 비밀번호 (bcrypt, 서버) — PIN 6자리 이상, 서버 rate limit", detail: "PBKDF2-SHA256 310k회로 PIN에서 유도한 비밀번호의 bcrypt 해시 · PIN으로 감싼 마스터키(암호문, 본인만 조회) · 임시 PIN 여부 — PIN 자체는 서버에 없음",
    purpose: "서버 PIN 검증 · 마스터키 배포", basis: "안전성 확보조치 기준 §7 비밀번호 · §5 접근권한", encrypted: "해시 · 래핑", retention: "로그인 해제 시 삭제", days: null },
  { id: "cloud.token", server: true, store: "IndexedDB (session · 봉인)", label: "서버 세션 토큰 (IndexedDB 세션 레코드)", detail: "PocketBase 인증 토큰 — 세션 키로 봉인되어 세션 레코드 안에만 저장 (localStorage 아님) · 잠금·만료 시 삭제 · PIN 재설정 시 서버가 무효화",
    purpose: "잠금 해제 상태에서 서버 호출 (접수 보드 · 사용자 관리)", basis: "안전성 확보조치 기준 §5 — 세션 관리", encrypted: "세션 키로 봉인", retention: "잠금·만료 시 삭제", days: null },
  { id: "pbUrl", match: exact("pbUrl"), label: "서버 주소 (개발용 override)", detail: "?pb=… 또는 localStorage로 지정한 PocketBase 주소 — 없으면 clinic-admin.pb.gurum.se (개인정보 아님)",
    purpose: "로컬 테스트 서버 지정 (tools/e2e.mjs)", basis: "—", encrypted: false, retention: "설정", days: null },
  { id: "__internal", match: (k) => k.startsWith("__") && k !== "__lock", label: "내부 메타", detail: "마지막 저장 시각·키별 수정 시각",
    purpose: "동기화 표시·처리 현황", basis: "—", encrypted: false, retention: "설정", days: null }
];

// Rows whose count is "keys present", not "items inside" (scalar settings / one profile object).
const ONE_PER_KEY = new Set(["jabo.draft", "yearend", "ui", "ai.settings", "org.profile", "tariff", "insurers.lastUsed"]);

async function inventory() {
  const keys = Store.keys();
  const rows = [];
  const seen = new Set();
  for (const r0 of REGISTRY) {
    const r = loc(r0);
    if (r.id === "masters") {
      const recs = ["kcd", "fee"].map(k => Masters.get(k)).filter(Boolean);
      rows.push({ ...r, keys: recs.map(m => m.id), count: recs.reduce((n, m) => n + (m.count || 0), 0), lastModified: null, present: recs.length > 0 });
      continue;
    }
    if (r.id === "session") {
      let rec = null;
      try { rec = await Session.sessionRecord(); } catch {}
      rows.push({ ...r, keys: [`${Session.SESSION_DB}/${Session.SESSION_STORE}`], count: rec ? 1 : 0, lastModified: rec?.lastActiveAt || null, present: !!rec });
      continue;
    }
    if (r.server) {
      const n = r.id === "cloud.directory" ? Session.users().length : r.id === "cloud.password" ? Session.users().length : (Session.isAuthed() ? 1 : 0);
      rows.push({ ...r, keys: [r.store], count: n, lastModified: null, present: n > 0 });
      continue;
    }
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
      count += ONE_PER_KEY.has(r.id) ? (v == null || v === "" ? 0 : 1) : r.id === "claims.batch" ? 1 : len(v);
      const m = Store.mtime(k); if (m && (!last || m > last)) last = m;
    }
    rows.push({ ...r, keys: mine, count, lastModified: last, present: mine.length > 0 });
  }
  for (const k of keys) if (!seen.has(k)) rows.push({ id: k, label: t("lifecycle.unregistered", { key: k }), detail: t("lifecycle.unregisteredDetail"), purpose: "?", basis: "?", encrypted: Store.isSensitive(k), retention: "?", keys: [k], count: len(Store.get(k)), lastModified: Store.mtime(k), present: true, unregistered: true });
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
      if (kept == null) { Store.remove(k); out[r.id] = (out[r.id] || 0) + 1; continue; } // whole record expired (a batch)
      const removed = len(v) - len(kept);
      if (removed > 0) { Store.set(k, kept); out[r.id] = (out[r.id] || 0) + removed; }
    }
  }
  // Orphan attachments: photos whose staff row no longer exists.
  try {
    const owners = new Set(Staff.list().map(s => s.id));
    const st = await Attachments.stats();
    const orphans = st.owners.filter(o => !owners.has(o));
    if (orphans.length) out.attachments = await Attachments.deleteByOwners(orphans);
  } catch {}
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (total) {
    const parts = Object.entries(out).map(([id, n]) => t("lifecycle.purgedPart", { label: loc(REGISTRY.find(r => r.id === id) || { id, label: id }).label, n })).join(" · ");
    ActivityLog.add({ tag: "system", action: t("lifecycle.purgedAction", { parts }), meta: { silent: true } });
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
    if (r.id === "masters") { await Masters.clear("kcd"); await Masters.clear("fee"); n++; continue; }
    if (r.store === "IndexedDB") { await Attachments.clearAll(); n++; continue; }
    if (r.id === "__lock" || r.id === "__internal" || r.id === "session" || r.server) continue; // only via 전체 파기 (session: via 잠금; server rows: via the 사용자 panel)
    for (const k of Store.keys().filter(r.match)) { Store.remove(k); n++; }
  }
  if (n) ActivityLog.add({ tag: "system", action: t("lifecycle.destroyedAction", { ids: ids.join(", ") }), meta: { silent: true } });
  return n;
}

/* 전체 파기 — THIS DEVICE: data + attachments + uploaded masters + lock settings + session (server logout). The server
   accounts and the shared board are the clinic's and stay (the 원장 removes logins in the 사용자 panel). Caller has
   already collected the typed "파기". Masters are public reference tables, but a wipe is total. */
async function destroyAll() {
  try { ActivityLog.add({ tag: "system", action: t("lifecycle.destroyAllAction"), meta: { silent: true } }); } catch {}
  await Store.wipeAll({ keepWorkspace: false });
  try { await Masters.destroy(); } catch (e) { console.warn("masters wipe", e); }
  await Session.destroy(); // drops the IndexedDB session store (incl. the sealed server token) too
  try { localStorage.removeItem("vibe.clinic-admin.player-id"); } catch {}
}

/* ── Encrypted backup ─────────────────────────────────────────────────────────────
   { format, v, exportedAt, poc, keyring, sensitive: { key: envelope }, plain: envelope, attachments: [raw] }
   `sensitive` are the stored envelopes verbatim; `plain` is the non-sensitive keys bundled and
   encrypted too, so the file contains no readable app data at all.
   v3 (shared identity): `keyring` = { v:3, workspace, users:[ the EXPORTING user's wrapped copy of the clinic key ] }.
   Restore unwraps it with that user's PIN, then proves ONLINE that it is the clinic's key (Cloud.login with the same
   PIN → unwrap the server copy → byte-equal); a file made under another master key is refused before anything is
   touched. v1/v2 files (device-local keyrings) are refused — their key is not the clinic key; the upgrade path for an
   old device is the lock screen's "이 기기의 워크스페이스를 서버로 올리기". */
const BACKUP_FORMAT = "vibe.clinic-admin.backup";
const BACKUP_VERSION = 3;
const BACKUP_VERSIONS_ACCEPTED = [3];

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
    format: BACKUP_FORMAT, v: BACKUP_VERSION, exportedAt: new Date().toISOString(), poc: POC_MARK,
    keyring: Session.exportKeyring(),
    sensitive,
    plain: await encryptJSON(Session.key(), plain),
    attachments: await Attachments.exportRaw()
  };
  const json = JSON.stringify(bk);
  downloadText(json, `clinic-admin_backup_${new Date().toISOString().slice(0, 10)}.json`);
  ActivityLog.add({ tag: "system", action: t("lifecycle.backupAction", { n: Object.keys(sensitive).length + Object.keys(plain).length, a: bk.attachments.length }) });
  return bk;
}

function parseBackup(text) {
  let bk;
  try { bk = JSON.parse(text); } catch { throw new Error(t("lock.errNotJson")); }
  if (!bk || bk.format !== BACKUP_FORMAT) throw new Error(t("lock.errNotBackup"));
  if (bk.v === 1 || bk.v === 2) throw new Error(t("lock.errLegacyBackup", { v: bk.v }));
  if (!BACKUP_VERSIONS_ACCEPTED.includes(bk.v) || !bk.keyring?.users?.length || !isEnvelope(bk.plain)) throw new Error(t("lock.errNotBackup"));
  return bk;
}

/* Restore replaces everything in this profile. Throws on a wrong PIN / a foreign key / no server before touching
   anything. The session that follows is NOT persisted (Session.adopt) — a restore always ends with a PIN entry on the
   next load. Needs the server: the backup's key is compared byte-for-byte with the clinic key that PIN unwraps. */
async function restoreBackup(bk, userId, pin) {
  const raw = await Session.unwrapFromKeyring(bk.keyring, userId, pin); // wrong PIN → throws here
  const key = await importSessionKey(raw);
  const plain = await decryptJSON(key, bk.plain);                       // proves the key matches the data
  let login;
  try { login = await Cloud.login(userId, pin); }
  catch (e) { throw new Error(e.code === "offline" ? t("cloud.errOffline", { s: 0 }) : e.code === "wrong-pin" ? t("lock.errWrongPin") : e.code === "rate" ? t("cloud.errRate") : t("lock.errRestoreUser")); }
  const serverRaw = await unwrapMaster(login.wrapped, pin);
  const same = raw.length === serverRaw.length && raw.every((b, i) => b === serverRaw[i]);
  if (!same) { Cloud.logout(); throw new Error(t("lock.errKeyMismatchBackup")); }
  Session.lock("restore");                                              // also deletes the IndexedDB session record (+ logs out)
  await Store.wipeAll({ keepWorkspace: false });
  for (const [k, env] of Object.entries(bk.sensitive || {})) if (isEnvelope(env)) localStorage.setItem(`${NS}.${k}`, JSON.stringify(env));
  for (const [k, v] of Object.entries(plain || {})) localStorage.setItem(`${NS}.${k}`, JSON.stringify(v));
  await Attachments.importRaw(bk.attachments || []);
  try { await Cloud.login(userId, pin); } catch {} // a token for the board — best effort, the data is already readable
  await Session.adopt(raw, login.user, login.wrapped);
  const r = await Store.whenUnlocked();
  ActivityLog.add({ tag: "system", action: t("lifecycle.restoreAction", { at: bk.exportedAt }) });
  return { keys: Object.keys(bk.sensitive || {}).length + Object.keys(plain || {}).length, attachments: (bk.attachments || []).length, version: bk.v, migrated: r?.hooks || null };
}

/* Phase 3: tab modules register their own Store keys at module load (tabs → security is an allowed import direction).
   registerRows([{ key?, id?, match?, label, detail, purpose, basis, encrypted, retention, days?, purge? }])
     · `key` alone is enough for a single exact key: `id` defaults to it and `match` to (k) => k === key.
     · `encrypted: true` puts the key on Store's AES-GCM tier (SENSITIVE_KEYS.exact) — main.js imports every tab module before
       the first unlock, so the tier is known before Store.unlockedInit decrypts. Store.js already lists the Phase-3 keys; this
       is the safety net for the next module.
     · Registering an id twice is a no-op (the first row wins). */
export function registerRows(rows) {
  for (const r0 of Array.isArray(rows) ? rows : []) {
    if (!r0) continue;
    const { key, ...rest } = r0;
    const r = { id: r0.id || key, match: r0.match || (key ? exact(key) : null), days: null, ...rest };
    if (!r.id || (!r.match && !r.store)) { console.warn("registerRows: row needs an id + match (or key)", r0); continue; }
    if (r.encrypted === true && key && !Store.isSensitive(key)) SENSITIVE_KEYS.exact.push(key);
    if (!REGISTRY.some(x => x.id === r.id)) REGISTRY.push(r);
  }
}
export { REGISTRY, inventory, purgeExpired, destroy, destroyAll, exportBackup, parseBackup, restoreBackup, BACKUP_FORMAT, BACKUP_VERSION };
