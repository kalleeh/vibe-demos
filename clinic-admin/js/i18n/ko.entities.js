/* clinic-admin — Korean strings for the shared-entities layer: 기관 프로필 (Org), 직원 명부 + 로그인 (Staff), 가명 환자
   (Patients), the board's pid picker and the lifecycle rows of the new keys. Merged into the flat dictionary by
   core/i18n.js; the base ko.js keeps everything that predates the entities pass. */
export default {
  /* ── 기관 프로필 (core/entities.js Org · core/org-form.js) ── */
  "org.eyebrow": "기관 정보 · 1회 입력",
  "org.stepTitle": "어느 <em>기관</em>의 행정실인가요?",
  "org.stepNote": "기관명·요양기관기호·사업자등록번호·종별·대표자는 비급여 보고·연말정산 자료·자보 정산표의 머리글에 쓰입니다. 지금 건너뛰어도 됩니다 — 상단 기관 칩이나 ⓘ 정보에서 언제든 입력할 수 있어요. 데모라면 「샘플 데이터로 둘러보기」가 한솔한방병원으로 채워줍니다.",
  "org.f.name": "기관명", "org.f.ykiho": "요양기관기호 (8자리)", "org.f.biz": "사업자등록번호", "org.f.kind": "종별", "org.f.rep": "대표자",
  "org.phName": "예: 한솔한방병원", "org.phYkiho": "11000123", "org.phBiz": "123-45-67890", "org.phRep": "예: 윤지훈",
  "org.kind.병원": "병원 (한방병원)", "org.kind.의원": "의원 (한의원)",
  "org.skipBtn": "나중에 입력", "org.statusComplete": "입력 완료", "org.statusIncomplete": "미입력 항목 있음",
  "org.errYkiho": "요양기관기호는 숫자 8자리입니다", "org.errBiz": "사업자등록번호는 000-00-00000 형식입니다",
  "org.logSaved": "기관 정보 저장", "org.savedToast": "기관 정보 저장 — {name}", "org.msgSaved": "저장했습니다",
  "org.unsetChip": "기관 정보 미입력", "org.chipTitle": "기관 프로필 — {kind} · 대표 {rep} (클릭하여 수정)", "org.chipTitleIncomplete": "기관 정보가 비어 있습니다 — 클릭하여 입력 (보고·제출 파일 머리글에 쓰입니다)",
  "org.col.name": "기관명", "org.col.ykiho": "요양기관기호", "org.col.biz": "사업자등록번호", "org.col.kind": "종별", "org.col.rep": "대표자",
  "shell.infoOrgH": "기관 정보", "shell.infoOrgNote": "모든 보고·제출 파일의 머리글에 들어가는 기관 정보입니다 (이 브라우저에만 저장 · 개인정보 아님).",

  /* ── 가명 환자 (Patients) · 접수 보드 ── */
  "entities.patientAlias": "환자 {ref}",
  "board.newPatient": "+ 새 가명 환자 (P-YYYY-NNNN 자동 생성)",

  /* ── 직원 명부 + 로그인 (Staff · tab 08) ── */
  "license.loginH": "로그인 발급", "license.loginRoleLabel": "시스템 권한", "license.loginOk": "발급",
  "license.loginNote": "「원장」 권한은 사용자·PIN 관리, 활동 기록 내보내기, 전체 파기를 할 수 있습니다. PIN은 저장되지 않고 마스터키를 감싸는 데만 쓰입니다.",
  "license.loginWho": "{name} ({job}) 에게 워크스페이스 로그인을 발급합니다",
  "license.issueLogin": "로그인 발급", "license.revokeLogin": "로그인 해제", "license.noLogin": "로그인 없음",
  "license.ownerTag": "원장 권한", "license.loginTag": "로그인 · {role}", "license.loginTagTitle": "이 직원은 자기 PIN으로 워크스페이스를 열 수 있습니다", "license.meTag": "나",
  "license.logLoginIssued": "로그인 발급 ({role})", "license.loginIssuedToast": "로그인 발급 — {who} · {role}",
  "license.confirmRevoke": "{who} 의 로그인을 해제할까요? 이 PIN으로는 더 이상 열 수 없습니다. 명부의 행은 남습니다.",
  "license.logLoginRevoked": "로그인 해제", "license.loginRevokedToast": "로그인 해제 — {who}",
  "license.errHasLogin": "로그인이 연결된 직원입니다 — 먼저 로그인을 해제하세요.",

  /* ── 사용자 패널 (view over Staff logins) ── */
  "users.ownerTag": "원장 권한", "users.revokeLogin": "로그인 해제",
  "users.addNoteOwner": "이름이 명부에 있으면 그 행에 연결되고, 없으면 새 행이 추가됩니다 (직종은 권한에 따라 한의사·행정·원무).",
  "users.confirmRevokeLogin": "{name} ({role}) 의 로그인을 해제할까요? 이 PIN으로는 더 이상 열 수 없습니다. 명부의 직원 행은 남습니다.",
  "users.logRevokeLogin": "로그인 해제 ({role})", "users.msgLoginRevoked": "로그인을 해제했습니다",
  "users.rosterNote": "로그인은 직원 명부(08)의 한 행에 연결됩니다 — 직종·면허는 명부에서, PIN은 여기서.", "users.openRoster": "명부 열기 →",

  /* ── seed · lifecycle ── */
  "shell.logSeedEntities": "샘플 기관 데이터 — 직원 {n}명 · 로그인 {l}건 · 가명 환자 {p}명",
  "shell.seededLogins": "샘플 로그인(윤지훈·정수아·한지우) PIN은 {pin}입니다.",
  "lifecycle.restoreMigrated": "v{v} 백업 — 기관·명부·단가표 항목을 새 구조로 이전"
};
