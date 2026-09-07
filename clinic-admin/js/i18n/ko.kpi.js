/* clinic-admin — Korean strings for the Phase-3 HOME KPIs + RECORDS outputs (P3c): 홈 management tiles · merged todo ·
   비급여 가격표 이력/CSV · 보존 파기 대장 · 연말정산 환자 문의 대응. Merged by core/i18n.js LAST (base → entities → claims →
   reporting → ia → kpi), so a key here overrides an earlier file of the same name (the two `today.*` overrides below).
   Namespaces owned here: today.* (additions/overrides) · bigeup.* · retention.* · yearend.* additions. en.kpi.js mirrors every key. */
export default {
  /* (no overrides — the extract tool treats a key defined in two files as drift) */

  /* ── 홈 · 이번 달 숫자 (static) ── */
  "today.kpi.month": "기준 월",
  "today.kpi.copyBtn": "원장 보고용 요약 복사 <span class=\"arrow\">⧉</span>",
  "today.kpi.nhis": "건보 청구",
  "today.kpi.nhisNone": "건보 심사결과 배치 없음",
  "today.kpi.appeal": "이의신청 현황",
  "today.kpi.appealSub": "진행 중 · 지연 · 회수 금액",
  "today.kpi.ar": "미수금 지표",
  "today.kpi.arSub": "청구 − 인정 중 아직 이의신청하지 않은 금액",
  "today.kpi.nonpay": "비급여 매출 추정",
  "today.kpi.nonpayNone": "비급여 동의 기록이 쌓이면 단가표로 추정",
  "today.kpi.guar": "지불보증 만료 임박",
  "today.kpi.guarSub": "7일 안에 만료되는 지불보증 (환자 › 자보 지불보증)",
  "today.kpi.caveat": "※ 자보·건보는 심사결과 대조 기록에서, 이의신청·지불보증·비급여 동의는 각 대장에서 집계합니다. 미수금·비급여 매출은 <em>추정치</em>입니다 — 회계 자료가 아닙니다.",
  /* ── 홈 · 이번 달 숫자 (dynamic) ── */
  "today.payer.auto": "자보", "today.payer.nhis": "건보",
  "today.kpi.nhisRate": "건보 {r}%",
  "today.kpi.arDetail": "조정 {cut} − 이의신청 {ap}",
  "today.kpi.appealDetail": "지연 {o}건 · 회수 {r}",
  "today.kpi.guarOver": "이미 만료 {n}건 — 지불보증 패널에서 확인",
  "today.kpi.nonpayDetail": "동의 {n}건 · {i}개 항목 · {m}",
  "today.insRetDisposed": "파기 대장 {n}건",
  /* ── 홈 · 원장 보고용 요약 (plain text — institution + numbers, never a person's name) ── */
  "today.sum.title": "[{org}] {m} 행정 요약 — 원장 보고용",
  "today.sum.auto": "자보: {n}건 · 청구 {c} → 인정 {a} · 조정 {cut} ({r}%)",
  "today.sum.nhis": "건보: {n}건 · 청구 {c} → 인정 {a} · 조정 {cut} ({r}%)",
  "today.sum.nhisNone": "건보: 심사결과 배치 없음",
  "today.sum.reason": "최다 조정사유: {list}",
  "today.sum.reasonNone": "최다 조정사유: 기록 없음",
  "today.sum.insurers": "보험사별 조정: {list}",
  "today.sum.insurersNone": "보험사별 조정: 기록 없음",
  "today.sum.appeals": "이의신청: 진행 {o}건 · 제출 {s}건 · 지연 {d}건 · 회수 {r}",
  "today.sum.ar": "미수금 지표(청구 − 인정, 미신청): {amt}",
  "today.sum.nonpay": "비급여 매출 추정: {amt} (동의 {n}건 × 단가표)",
  "today.sum.nonpayNone": "비급여 매출 추정: — (동의 기록 없음)",
  "today.sum.guar": "지불보증 만료 임박(7일): {n}건 · 이미 만료 {o}건",
  "today.sum.retention": "보존: 보존기간 경과 {o}건 · 파기 대장 {d}건",
  "today.sum.retentionNone": "보존: 감사 기록 없음",
  "today.sum.foot": "— {date} 기준 · {poc}",
  "today.sum.copyFallback": "요약을 화면에 표시했습니다 — 클립보드 복사는 이 브라우저에서 허용되지 않았습니다.",
  "today.sum.log": "원장 보고용 요약 복사 ({m})",
  /* ── 홈 · 지금 할 일 (merged list) ── */
  "today.todo.setup": "설정",
  "today.todo.group.over": "지연", "today.todo.group.today": "오늘", "today.todo.group.week": "이번 주", "today.todo.group.month": "이번 달",
  "today.todo.more": "더 보기 — {n}건",
  "today.nudge.orgMeta": "조직 › 기관 프로필",
  "today.nudge.staffMeta": "조직 › 직원 명부",
  "today.dl.appealSource": "심평원 이의신청 기한 · 청구 › 이의신청",
  "today.dl.guaranteeSource": "보험사 지불보증 만료 · 환자 › 지불보증",

  /* ── 04 비급여 · 홈페이지 CSV + 변경 이력 ── */
  "bigeup.history.h": "가격표 변경 이력",
  "bigeup.history.summary": "홈페이지 게시용 가격표는 <em>항목 · 가격 · 적용일</em> 세 컬럼의 CSV로, 변경 이력은 단가를 저장할 때마다 자동으로 쌓입니다 (변경 시각 · 적용일 · 이전 → 이후 금액 · 담당).",

  "bigeup.history.count": "변경 기록",
  "bigeup.history.empty": "단가를 저장하면 변경 이력이 여기에 쌓입니다.",
  "bigeup.history.thWhen": "변경 시각", "bigeup.history.thCount": "항목 수", "bigeup.history.thChanges": "변경 (코드 이전 → 이후)", "bigeup.history.thBy": "담당",
  "bigeup.history.more": "외 {n}건",
  "bigeup.history.col.when": "변경시각", "bigeup.history.col.date": "적용일", "bigeup.history.col.from": "이전금액", "bigeup.history.col.to": "이후금액", "bigeup.history.col.by": "담당",
  "bigeup.history.file": "비급여_가격표_변경이력_{date}.csv", "bigeup.history.log": "비급여 가격표 변경 이력 CSV 내려받음 ({n}행)",
  "bigeup.web.col.item": "항목", "bigeup.web.col.cat": "분류", "bigeup.web.col.unit": "단위", "bigeup.web.col.price": "가격(원)", "bigeup.web.col.date": "적용일",
  "bigeup.web.file": "비급여_홈페이지_고지_{date}.csv", "bigeup.web.log": "홈페이지 고지용 비급여 CSV 내려받음 ({n}개 항목)",

  /* ── 05 보존 · 파기 대장 ── */
  "retention.dispose.h": "파기 대상 목록 → 파기 대장",
  "retention.dispose.caveat": "보존기간이 지난 기록만 대상입니다. 파기는 <em>내부 폐기 심의</em>(법정 의무 아님)를 거친 뒤 실행하고, 대장에는 기록ID를 가명화해 남깁니다 — 담당자는 현재 로그인, 승인자는 명부에서 고릅니다. 저장되는 대장은 이 브라우저 안에서 암호화됩니다.",
  "retention.dispose.empty": "점검 결과에 보존기간 경과 기록이 있으면 여기에 파기 대상이 나열됩니다.",
  "retention.dispose.summary": "파기 대상 <strong>{n}건</strong> · 미처리 <strong>{p}건</strong> · 누적 대장 {d}건",
  "retention.dispose.btn": "파기 대장 생성 <span class=\"arrow\">↓</span>",
  "retention.dispose.method": "방법", "retention.dispose.approver": "승인자", "retention.dispose.officer": "담당자", "retention.dispose.noApprover": "명부에 한의사·행정 없음",
  "retention.dispose.thRec": "기록ID (가명)", "retention.dispose.done": "대장 기록됨", "retention.dispose.pending": "파기 대상",
  "retention.dispose.locked": "잠금 상태에서는 파기 대장을 만들 수 없습니다.",
  "retention.dispose.log": "파기 대장 생성 — {n}건 ({m})", "retention.dispose.status": "파기 대장 {n}건을 기록하고 XLSX로 내려받았습니다 — 실제 파기는 내부 절차에 따라 진행하세요.",
  "retention.method.shred": "파쇄", "retention.method.erase": "전자삭제",
  "retention.ledger.h": "파기 대장 (누적)",
  "retention.ledger.summary": "생성된 파기 대장은 여기에 누적됩니다 — 인증 자체점검(기록부 폐기 심의 절차)의 증빙으로 쓰입니다.",

  "retention.ledger.empty": "아직 파기 대장이 없습니다.",
  "retention.ledger.thDate": "파기일", "retention.ledger.more": "외 {n}건 (XLSX에는 전체)",
  "retention.ledger.col.rec": "기록ID(가명)", "retention.ledger.col.pid": "환자(별칭)", "retention.ledger.col.type": "기록종류", "retention.ledger.col.expiry": "보존기한",
  "retention.ledger.col.disposedOn": "파기일", "retention.ledger.col.officer": "담당자", "retention.ledger.col.method": "파기방법", "retention.ledger.col.approver": "승인자", "retention.ledger.col.note": "비고",
  "retention.ledger.file": "의무기록_파기대장_{date}.xlsx", "retention.ledger.sheet": "파기 대장", "retention.ledger.log": "파기 대장 전체 내려받음 ({n}건)",

  /* ── 03 연말정산 · 환자 문의 대응 ── */
  "yearend.lookup.h": "환자 문의 대응 — \"제 자료 들어갔나요?\"",
  "yearend.lookup.summary": "1월 전화 대응용 — <em>환자번호</em>를 넣으면 최근 점검 배치에 그 환자의 진료가 들어 있는지, 합계는 얼마인지 바로 보입니다. 영수증 재발급이 필요하면 <em>발급 대장</em>으로 넘깁니다.",
  "yearend.lookup.btn": "조회",
  "yearend.lookup.empty": "환자번호를 입력하면 최근 점검 배치에서 찾아봅니다.",
  "yearend.lookup.noBatch": "{who} — 아직 점검 배치가 없습니다. 진료 기록을 먼저 올려주세요.",
  "yearend.lookup.unknownPid": "가명 환자 대장에 없음",
  "yearend.lookup.inBatch": "과세연도 {y} 자료에 포함", "yearend.lookup.notInBatch": "과세연도 {y} 자료에 없음",
  "yearend.lookup.missingHint": "자보 진료(본인부담 없음)·비급여 현금결제는 자료에 빠지는 것이 정상일 수 있습니다. 누락이면 EMR에서 해당 진료를 추가해 다시 점검하세요.",
  "yearend.lookup.docsBtn": "영수증 재발급 대장에 기록",
  "yearend.lookup.docsHint": "환자 › 발급 대장에 「영수증 재발급」 건을 만듭니다.",
  "yearend.lookup.log": "연말정산 문의 → 영수증 재발급 대장 인계"
};
