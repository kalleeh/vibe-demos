/* clinic-admin — Korean strings for the Phase-2 information architecture: the five areas + two utilities (rail, bottom bar,
   sub-nav, crumb), the global search overlay, the AI drawer chrome, the task-first 홈, the 청구 배치 landing and the new
   환자 · 조직 panels. Merged by core/i18n.js after ko.reporting.js; keys are NEW here (never re-declared — the extract
   tool flags duplicates). Korean is the source of truth; en.ia.js mirrors every key. */
export default {
  /* ── areas · navigation chrome ── */
  "nav.area.home": "홈", "nav.area.patients": "환자", "nav.area.claims": "청구", "nav.area.records": "보고·기록", "nav.area.org": "조직",
  "nav.board": "접수 보드", "nav.claims": "청구 배치", "nav.org": "기관 프로필", "nav.privacy": "데이터 처리 현황", "nav.masters": "마스터 업로드",
  "shell.areasAria": "영역", "shell.subnavAria": "하위 메뉴", "shell.moreBtn": "더보기",
  "shell.railAi": "✦ AI 코딩 어시스트", "shell.aiWord": "AI",
  "shell.aiBtnTitle": "AI 코딩 어시스트 — 어느 화면에서든 오른쪽 드로어로 (⌘K 안에서도 열 수 있습니다)",
  "shell.pal.utility": "유틸리티", "shell.pal.ai": "AI 코딩 어시스트 열기", "shell.pal.aiMeta": "진료 메모 → 상병·행위 코드 초안 (드로어)",
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
  "board.blurb": "접수 창구의 화이트보드를 그대로 옮겼습니다 — 가명 환자를 고르고 메모 한 줄이면 카드가 생기고, 다른 기기·탭에서도 <em>즉시 같은 판</em>을 봅니다. 카드 내용은 이 워크스페이스 키로 <em>종단간 암호화</em>되어 서버는 암호문만 봅니다. 지불보증·발급 대장·비급여 동의는 다음 단계에서 이 영역에 붙습니다.",

  /* ── 청구 › 청구 배치 landing ── */
  "claims.num": "청구 · 청구 배치",
  "claims.h3": "명세서 한 번 올리고, <em>세 단계</em>로 끝까지",
  "claims.badgeLaw": "자동차보험진료수가 기준 · 심평원 자보 심사", "claims.badgeLive": "상병 정비 → 심사결과 대조 → 이의신청",
  "claims.blurb": "<em>청구 배치</em>가 단위입니다 — EMR에서 뽑은 청구 명세서 export 한 장이 상병 정비와 심사결과 대조가 함께 쓰는 배치가 되고, 심평원 심사결과 파일은 그 배치에 연결됩니다. 여기서 두 파일을 올리고, 아래 세 단계의 <em>어디까지 왔는지</em>만 보세요. 이의신청은 다음 단계에서 붙습니다.",
  "claims.uploadH": "파일 업로드 — 청구 명세서 · 심사결과통보",
  "claims.dropClaims": "청구 명세서 export", "claims.dropClaimsHint": "명세서번호 · 환자번호 · 진료일자 · 상병코드 · 행위코드 · 청구금액 — 새 청구 배치가 됩니다",
  "claims.dropReview": "심평원 심사결과 파일", "claims.dropReviewHint": "명세서번호 · 행위코드 · 인정금액 · 조정사유 — 현재 배치에 연결됩니다",
  "claims.caveat": "※ 같은 파일을 <strong>상병 정비</strong>나 <strong>심사결과 대조</strong>에서 올려도 같은 배치가 됩니다. 배치는 브라우저 안에서 암호화되어 90일 · 최대 20건까지 보관됩니다 (조직 › 데이터 처리 현황).",
  "claims.stepsH": "진행 단계 — 현재 배치",
  "claims.statusClaims": "{src} — 명세서 {n}건을 새 청구 배치로 읽었습니다. 상병 정비부터 시작하세요.",
  "claims.statusReview": "{src} — 심사결과 {n}줄을 현재 배치에 연결했습니다. 심사결과 대조가 갱신됩니다.",
  "claims.card.empty": "청구 배치가 없습니다 — 왼쪽에서 청구 명세서 export를 올리면 여기에 배치 요약과 진행 단계가 보입니다.",
  "claims.card.noReview": "심사결과 없음",
  "claims.card.stmts": "명세서", "claims.card.patients": "환자", "claims.card.kcdLines": "상병 줄", "claims.card.itemLines": "행위 줄", "claims.card.created": "업로드", "claims.card.batches": "보관 배치",
  "claims.step.kcd": "상병 정비", "claims.step.noBatch": "청구 배치를 먼저 올려주세요",
  "claims.step.kcdNoSide": "이 배치에는 상병 컬럼이 없습니다 (행위만)",
  "claims.step.kcdTodo": "상병 {n}줄 — 아직 정비하지 않았습니다", "claims.step.kcdDone": "{n}건 검토 · 미수록/오류 {m}건 · 검토필요 {r}건",
  "claims.step.kcdBtn": "상병 정비 시작", "claims.step.kcdOpen": "상병 정비 열기",
  "claims.step.recon": "심사결과 대조", "claims.step.reconNoSide": "이 배치에는 행위 컬럼이 없습니다 (상병만)",
  "claims.step.reconNeed": "심평원 심사결과 파일이 아직 없습니다 — 올리면 명세서·행위 단위로 대조됩니다",
  "claims.step.reconTodo": "심사결과 {n}줄 연결됨 — 대조표를 확인하세요", "claims.step.reconDone": "조정 {cut} · 조정률 {rate}%",
  "claims.step.reconUpload": "심사결과 파일 올리기", "claims.step.reconBtn": "대조표 보기", "claims.step.reconOpen": "심사결과 대조 열기",
  "claims.step.appeal": "이의신청", "claims.step.appealSoon": "다음 단계 — 조정 건별 이의신청 추적기가 여기에 붙습니다", "claims.step.appealBtn": "준비 중",
  "claims.state.idle": "대기", "claims.state.todo": "할 일", "claims.state.need": "파일 필요", "claims.state.done": "완료", "claims.state.soon": "다음 단계",
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
  "masters.blurb": "내장 상병·행위 표는 <em>데모 발췌·예시</em>입니다. 여기서 <em>KOICD 상병마스터</em>와 <em>심평원 행위·수가 마스터</em>(xlsx)를 올리고 헤더를 매핑하면 상병 정비·심사결과 대조·검색·AI 어시스트가 모두 실제 마스터를 기준으로 동작합니다. 공개 참조표이므로 이 브라우저(IndexedDB)에만 보관됩니다."
};
