/* clinic-admin — Korean strings for the Phase-2 information architecture: the five areas + two utilities (rail, bottom bar,
   sub-nav, crumb), the global search overlay, the AI drawer chrome, the task-first 홈, the 청구 배치 landing and the new
   환자 · 조직 panels. Merged by core/i18n.js after ko.reporting.js; keys are NEW here (never re-declared — the extract
   tool flags duplicates). Korean is the source of truth; en.ia.js mirrors every key. */
export default {
  /* ── areas · navigation chrome ── */
  "nav.area.home": "홈", "nav.area.patients": "환자", "nav.area.claims": "청구", "nav.area.records": "보고·기록", "nav.area.org": "조직",
  "nav.board": "접수 보드", "nav.claims": "청구 배치", "nav.org": "기관 프로필", "nav.privacy": "데이터 처리 현황", "nav.masters": "마스터 업로드",
  "shell.areasAria": "영역", "shell.subnavAria": "하위 메뉴", "shell.moreBtn": "더보기",
  "shell.aiWord": "AI",
  "shell.aiBtnTitle": "AI 어시스트 — 어느 화면에서든 오른쪽 드로어로 (⌘K 안에서도 열 수 있습니다)",
  "shell.pal.utility": "유틸리티", "shell.pal.ai": "AI 어시스트 열기", "shell.pal.aiMeta": "진료 메모 → 상병·행위 코드 초안 (드로어)",
  "shell.pal.info": "정보 · 출처", "shell.pal.infoMeta": "근거 링크 · 버전 · 기관 요약",

  /* ── global search overlay ── */
  "search.overlayAria": "검색 · 이동 · 명령",
  "search.overlayPlaceholder": "이동 · 명령 · 코드 — 요통, S13.4, ㅇㅈ, 잠금…",
  "search.navH": "이동 · 명령",
  "search.codesH": "코드 — 상병 · 행위·수가 · 비급여",
  "search.demoBtn": "예시 검색어: \"요통\"",
  "search.shownMax": "처음 {n}건 표시 (XLSX에는 전체)",

  /* ── 홈 (task-first) ── */
  "home.todoH": "지금 할 일", "home.numbersH": "이번 달 숫자", "home.recentH": "최근 작업", "home.deadlinesH": "다가오는 마감 · 전체", "home.activityH": "활동",
  "home.todo.empty": "지금 할 일이 없습니다 — 30일 안의 마감도, 열려 있는 청구 단계도 없어요.",
  "home.todo.count": "{n}건", "home.todo.open": "열기", "home.todo.step": "청구", "home.todo.resume": "이어서", "home.todo.resumeBtn": "이어하기",
  "home.todo.manualCase": "자보 수기 케이스 진행 중 — {who}",

  /* ── 환자 › 접수 보드 panel ── */
  "board.num": "환자 · 접수 보드",
  "board.h3": "오늘 <em>대기 · 진료중 · 완료</em>, 한 판에",
  "board.badgeLive": "PocketBase 실시간 · E2E 암호화", "board.badge": "가명 환자만 · 실명 입력 불가",
  "board.blurb": "접수 창구의 화이트보드를 그대로 옮겼습니다 — 가명 환자를 고르고 메모 한 줄이면 카드가 생기고, 다른 기기·탭에서도 <em>즉시 같은 판</em>을 봅니다. 카드 내용은 이 워크스페이스 키로 <em>종단간 암호화</em>되어 서버는 암호문만 봅니다. 카드의 <em>⋯</em> 메뉴에서 그 환자의 <em>자보 지불보증</em>·<em>서류 발급 대장</em>·<em>비급여 설명·동의</em>를 바로 열 수 있습니다 — 세 추적기가 이 영역의 나머지 패널입니다.",

  /* ── 청구 › 청구 배치 landing (the payer-aware head copy — claims.p3.* — and the payer cards live in ko.claims2.js) ── */
  "claims.num": "청구 · 청구 배치",
  "claims.uploadH": "파일 업로드 — 청구 명세서 · 심사결과통보",
  "claims.dropClaims": "청구 명세서 export",
  "claims.dropReview": "심평원 심사결과 파일", "claims.dropReviewHint": "명세서번호 · 행위코드 · 인정금액 · 조정사유 — 현재 배치에 연결됩니다",
  "claims.caveat": "※ 같은 파일을 <strong>상병 정비</strong>나 <strong>심사결과 대조</strong>에서 올려도 같은 배치가 됩니다. 배치는 브라우저 안에서 암호화되어 90일 · 최대 20건까지 보관됩니다 (조직 › 데이터 처리 현황).",
  "claims.statusReview": "{src} — 심사결과 {n}줄을 현재 배치에 연결했습니다. 심사결과 대조가 갱신됩니다.",
  "claims.card.noReview": "심사결과 없음",
  "claims.card.stmts": "명세서", "claims.card.patients": "환자", "claims.card.kcdLines": "상병 줄", "claims.card.itemLines": "행위 줄", "claims.card.created": "업로드",
  "claims.step.kcd": "상병 정비", "claims.step.noBatch": "청구 배치를 먼저 올려주세요",
  "claims.step.kcdNoSide": "이 배치에는 상병 컬럼이 없습니다 (행위만)",
  "claims.step.kcdTodo": "상병 {n}줄 — 아직 정비하지 않았습니다", "claims.step.kcdDone": "{n}건 검토 · 미수록/오류 {m}건 · 검토필요 {r}건",
  "claims.step.kcdBtn": "상병 정비 시작", "claims.step.kcdOpen": "상병 정비 열기",
  "claims.step.recon": "자보 심사결과 대조", "claims.step.reconNoSide": "이 배치에는 행위 컬럼이 없습니다 (상병만)",
  "claims.step.reconNeed": "심평원 심사결과 파일이 아직 없습니다 — 올리면 명세서·행위 단위로 대조됩니다",
  "claims.step.reconTodo": "심사결과 {n}줄 연결됨 — 대조표를 확인하세요", "claims.step.reconDone": "조정 {cut} · 조정률 {rate}%",
  "claims.step.reconUpload": "심사결과 파일 올리기", "claims.step.reconBtn": "대조표 보기", "claims.step.reconOpen": "심사결과 대조 열기",
  "claims.step.appeal": "이의신청",
  "claims.state.idle": "대기", "claims.state.todo": "할 일", "claims.state.need": "파일 필요", "claims.state.done": "완료",
  "jabo.batch.open": "청구 배치 →",

  /* ── 조직 › 기관 프로필 panel ── */
  "org.num": "조직 · 기관 프로필",
  "org.h3": "어느 <em>기관</em>의 행정실인가요?",
  "org.badgeLaw": "의료법 §45조의2 · 소득세법 §165 자료 머리글", "org.badge": "이 브라우저에만 저장 · 개인정보 아님",
  "org.blurb": "기관명·요양기관기호·사업자등록번호·종별·대표자는 <em>비급여 보고 준비표</em>, <em>연말정산 자료</em>, <em>자보 정산표</em>의 머리글에 그대로 들어가고, 종별(병원·의원)은 비급여 보고 주기와 마감 캘린더를 정합니다. 한 번만 입력해두면 모든 화면이 같은 프로필을 읽습니다.",
  "org.panelH": "기관 프로필",
  "org.caveat": "※ 기관 정보는 사업자등록·요양기관 공개 정보로 <strong>개인정보가 아니어서</strong> 평문(plain tier)으로 저장됩니다 — 조직 › 데이터 처리 현황의 「기관 프로필」 행을 참고하세요. 데모라면 「샘플 데이터로 둘러보기」가 한솔한방병원으로 채웁니다.",

  /* ── 조직 › 데이터 처리 현황 panel ── */
  "privacy.badgeLaw": "개인정보보호법 §29 · 의료법 §21", "privacy.badge": "AES-GCM · 보존기간 자동 파기 · 암호화 백업",

  /* ── 조직 › 마스터 업로드 panel ── */
  "masters.num": "조직 · 마스터 업로드",
  "masters.h3": "내장 표는 <em>예시</em> — 실제 마스터를 올리면 그 표 기준",
  "masters.blurb": "내장 상병·행위 표는 <em>데모 발췌·예시</em>입니다. 여기서 <em>KOICD 상병마스터</em>와 <em>심평원 행위·수가 마스터</em>(xlsx)를 올리고 헤더를 매핑하면 상병 정비·심사결과 대조·검색·AI 어시스트가 모두 실제 마스터를 기준으로 동작합니다. 공개 참조표이므로 이 브라우저(IndexedDB)에만 보관됩니다.",
  // Phase 3 slots (coordinator scaffold)
  "nav.guarantee": "자보 지불보증",
  "nav.docs": "서류 발급 대장",
  "nav.consent": "비급여 설명·동의",
  "nav.nhis": "건보 심사결과 대조",
  "nav.appeal": "이의신청",
  "p3.guarantee.num": "환자 · 자보 지불보증",
  "p3.guarantee.h3": "보험사 <em>지불보증</em>, 전화·팩스 로그를 한 곳에",
  "p3.docs.num": "환자 · 서류 발급 대장",
  "p3.docs.h3": "진단서·확인서 <em>발급 대장</em>, 법정 기록으로",
  "p3.consent.num": "환자 · 비급여 설명·동의",
  "p3.consent.h3": "비급여 <em>사전설명·동의</em> 기록",
  "p3.nhis.num": "청구 · 건보 심사결과 대조",
  "p3.nhis.h3": "건강보험 <em>심사결과</em>를 청구 명세서와 대조",
  "p3.appeal.num": "청구 · 이의신청",
  "p3.appeal.h3": "조정 건의 <em>이의신청</em>, 기한과 함께",

  /* ── guided tour (js/tour.js) — 7 steps along the connected story ── */
  "tour.n": "{i} / {n}", "tour.prev": "← 이전", "tour.next": "다음 →", "tour.done": "완료", "tour.seedBtn": "샘플 데이터 채우기", "tour.seeded": "샘플 데이터가 채워져 있습니다",
  "tour.seed.title": "샘플 데이터로 시작", "tour.seed.body": "가상의 한솔한방병원 — 직원 7명, 가명 환자 5명, 2026-08 자보·건보 청구 배치, 심사결과, 이의신청 3건, 지불보증·발급 대장·동의 기록 — 이 한 번에 모든 화면을 채웁니다. 실제 환자 정보는 어디에도 입력하지 마세요.",
  "tour.todo.title": "홈 · 지금 할 일", "tour.todo.body": "출근하면 여기부터. 30일 안의 마감, 열려 있는 청구 단계, 만료 임박 지불보증, 기한 초과 이의신청이 한 줄씩 — 줄마다 버튼 하나로 그 자리로 갑니다. 아래 「이번 달 숫자」는 원장 보고용으로 복사할 수 있습니다.",
  "tour.claims.title": "청구 · 청구 배치", "tour.claims.body": "EMR 명세서 export 한 장이 배치가 되고, 보험유형에 따라 자보·건보로 나뉩니다. 각 배치의 세 단계 — 상병 정비 → 심사결과 대조 → 이의신청 — 가 어디까지 왔는지 나란히 보이고, 단계마다 버튼 하나로 이동합니다.",
  "tour.recon.title": "청구 · 자보 심사결과 대조", "tour.recon.body": "청구 명세서와 심평원 심사결과를 명세서번호+행위코드로 줄마다 대조합니다. 조정된 줄은 사유별·월별로 묶이고, 줄마다 「이의신청 준비」로 넘길 수 있습니다. 건보는 옆 패널에서 같은 방식으로.",
  "tour.appeal.title": "청구 · 이의신청", "tour.appeal.body": "조정 줄에서 넘어온 초안이 대장이 됩니다 — 통보일을 적으면 기한(+90일, 확인 필요)이 D-day로 붙고, 준비중 → 제출 → 결과로 상태를 옮기며, 초안은 인쇄할 수 있습니다. 기한 초과는 홈의 할 일에도 올라갑니다.",
  "tour.patients.title": "환자 · 세 추적기", "tour.patients.body": "자보 지불보증(보험사 통화·만료 D-day), 서류 발급 대장(법정 대장·발급자 확인), 비급여 설명·동의(단가표 기준) — 모두 가명 환자번호(****0142)만 저장합니다. 접수 보드의 카드 ⋯ 메뉴에서도 바로 열립니다.",
  "tour.org.title": "조직 · 직원 명부와 나머지", "tour.org.body": "직원 명부는 면허신고 기한(3년)을 계산하고 로그인(PIN)을 발급합니다. 기관 프로필은 모든 보고 파일의 머리글, 인증 자체점검은 다른 화면의 결과로 자동 판정, 데이터 처리 현황은 항목별 암호화·보존·파기·백업, 마스터 업로드는 KOICD·심평원 표. 끝 — 왼쪽 메뉴로 다니세요.",
};
