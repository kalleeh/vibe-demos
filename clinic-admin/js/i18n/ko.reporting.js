/* clinic-admin — Korean strings for the reporting flows (00 오늘 · 03 연말정산 · 04 비급여 · 05 보존 · 09 인증).
   Merged over the base dictionary (base → entities → claims → reporting, later wins), so an entry here also
   OVERRIDES a base key of the same name (the demo labels below moved to the five shared demo patients).
   Namespaces: today.* yearend.* bigeup.* retention.* accred.* — plus reporting.* for the shared institution block. */
export default {
  /* ── overrides of base keys (text changed with the shared demo data / KPI tiles) ── */
  "yearend.demoLabel": "5명 환자 · <strong>7건 진료</strong> — 주민번호 자릿수 오류·음수 금액·중복 행이 섞인 데이터로 사전점검 흐름을 미리 보실 수 있습니다.",
  "yearend.statusSample": "주민번호 자릿수 오류, 음수 금액, 중복 행이 섞인 5명 · 7건 (오류 {e}건). 주민등록번호는 자동 마스킹.",
  "retention.demoLabel": "<strong>9건 가상 기록 (2014–2016)</strong> — 보존기간 경과·만료 임박·분류 오류, 진료완료일이 없어 작성일자로 계산된 행까지 다양한 케이스로 점검표를 미리 보실 수 있습니다.",
  "today.insJabo": "이번 달 자보 청구",
  "today.insCut": "조정률",

  /* ── shared: institution block (03/04) + export columns ── */
  "reporting.org.ykiho": "요양기관기호",
  "reporting.org.bizNo": "사업자등록번호",
  "reporting.org.kind": "종별",
  "reporting.org.rep": "대표자",
  "reporting.org.missing": "미입력",
  "reporting.org.edit": "기관 정보 수정 →",
  "reporting.col.ykiho": "요양기관기호",
  "reporting.col.clinic": "의료기관명",
  "reporting.col.bizNo": "사업자등록번호",

  /* ── 00 오늘 ── */
  "today.nudge.aria": "설정 안내",
  "today.nudge.org": "기관 정보 미완료 — 기관명·요양기관기호·사업자등록번호·종별이 있어야 비급여·연말정산 준비표 헤더가 채워집니다.",
  "today.nudge.orgBtn": "기관 정보 입력",
  "today.nudge.staff": "직원 명부 비어 있음 — 면허신고 기한과 인증 자체점검(면허 관리)이 계산되지 않습니다.",
  "today.nudge.staffBtn": "직원 등록",
  "today.kpi.reason": "최다 조정사유",
  "today.kpi.reasonSub": "심사결과 배치에서 집계",
  "today.kpi.insurer": "보험사별 조정",
  "today.kpi.insurerSub": "조정액이 가장 큰 보험사",
  "today.kpi.empty": "청구 배치를 올리면 여기에 숫자가 채워져요",
  "today.kpi.claimVsApproved": "청구 {c} → 인정 {a} · {m}",
  "today.kpi.reasonCut": "조정 {amt} · {n}건",
  "today.kpi.reasonLines": "{n}건",
  "today.kpi.reasonNone": "조정사유 기록 없음",
  "today.kpi.insurerTop": "조정 {amt} · {k}개사",
  "today.kpi.insurerNone": "정산 기록에 보험사 정보 없음",
  "today.insAccredAuto": "자동 판정 미충족 {n}항목 — 눌러서 확인",
  "today.resume.yeLeft": "과세연도 {y} · 오류 {e}건 남음",

  /* ── 03 연말정산 ── */
  "yearend.pidHint": "청구 배치와 대조",
  "yearend.thPid": "환자번호",
  "yearend.col.pid": "환자번호",
  "yearend.recent": "최근 점검 배치 — {n}건 · 과세연도 {y} · 오류 {e} · {when}",
  "yearend.recentOpen": "다시 열기 (재업로드 없이)",
  "yearend.statusFromBatch": "저장된 배치 {n}건을 다시 열었습니다 ({when}). 성명·주민번호는 저장하지 않아 환자번호 별칭으로 표시됩니다.",
  "yearend.statusYearChanged": "과세연도를 {y}로 바꿨습니다 — 진료일자 범위를 다시 점검하려면 파일을 다시 올려주세요.",
  "yearend.xc.h": "청구 배치 대조 (환자번호 + 진료일)",
  "yearend.xc.meta": "과세연도 {y} · 청구 배치 내원 {n}건 중 {m}건 일치 · 배치 {when}",
  "yearend.xc.onlyClaims": "청구에는 있고 의료비 파일에 없음",
  "yearend.xc.onlyFile": "의료비 파일에는 있고 청구에 없음",
  "yearend.xc.none": "없음",
  "yearend.xc.more": "외 {n}건",
  "yearend.xc.stmt": "명세서 {s}",
  "yearend.xc.noPid": "의료비 파일에 환자번호(또는 등록번호) 컬럼이 없어 청구 배치와 대조하지 못했습니다.",
  "yearend.xc.caveat": "※ 자보(자동차보험) 진료는 본인부담이 없어 의료비 자료에 빠지는 것이 정상일 수 있고, 비급여 현금결제는 청구에 없는 것이 정상입니다 — 대조 결과는 참고용입니다.",

  /* ── 04 비급여 ── */
  "bigeup.fRefMonth": "참고월 (진료분)",
  "bigeup.refMonthOpt": "{m}월 진료분 → {mm}월 보고",
  "bigeup.ruleTwice": "병원급 — 3월·9월 진료분을 각각 4월·10월에 보고 (연 2회, 확인 필요)",
  "bigeup.ruleOnce": "의원급 — 3월 진료분만 4월에 보고 (연 1회, 확인 필요)",
  "bigeup.statusNoOrg": "요양기관기호가 없어 준비표를 내려받을 수 없습니다 — 기관 정보를 먼저 입력하세요.",
  "bigeup.notice.h": "가격 고지문 (접수 창구 게시용)",
  "bigeup.notice.summary": "의료법 §45 비급여 고지 — 입력된 단가로 접수 창구에 붙일 가격표를 만듭니다. 중간값을 고지 단가로, 최저–최고를 범위로 표시합니다.",

  "bigeup.notice.title": "{org} 비급여 진료비용 고지",
  "bigeup.notice.sub": "적용일 {date} · {n}개 항목 · 의료법 §45 · 예시 항목 (실제 고지는 심평원 표준코드 항목명으로)",
  "bigeup.notice.thPrice": "고지 단가",
  "bigeup.notice.thRange": "최저 – 최고",
  "bigeup.notice.foot": "{org} (요양기관기호 {ykiho}) · 대표자 {rep} — 비급여 진료 전 사전설명 후 동의를 받습니다.",
  "bigeup.notice.empty": "단가를 입력하면 고지문이 여기에 만들어집니다.",
  "bigeup.notice.docTitle": "비급여 가격 고지문 (PoC)",
  "bigeup.notice.log": "비급여 가격 고지문 인쇄 ({n}개 항목)",

  /* ── 05 보존 ── */
  "retention.thPatient": "환자",
  "retention.col.pid": "환자(별칭)",
  "retention.recent": "최근 점검 배치 — {n}건 · 경과 {o} · {when}",
  "retention.recentOpen": "다시 열기 (재업로드 없이)",
  "retention.statusFromBatch": "저장된 배치 {n}건을 다시 열었습니다 ({when}).",

  /* ── 09 인증 — 자동 판정 ── */
  "accred.autoLabel": "자동 판정",
  "accred.autoTitle": "직원 명부·비급여 단가표·최근 점검 결과로 앱이 판정한 항목",
  "accred.autoLegend": "<span class=\"accred-auto ok\"><span class=\"glyph\">✓</span> 자동 판정</span> 항목은 직원 명부·비급여 단가표·최근 점검 결과로 앱이 판정합니다 — 체크박스 대신 상태와 사유가 표시되고, 나머지는 직접 체크합니다.",
  "accred.auto.noAudit": "보존기간 점검 미실시 — 보고·기록 › 보존 감사에서 기록 대장을 점검하세요",
  "accred.auto.hr1.none": "직원 명부에 신고 대상(한의사·간호사 등)이 없음",
  "accred.auto.hr1.unreported": "신고 이력 미확인 {n}/{total}명",
  "accred.auto.hr1.imminent": "신고 기한 90일 이내 {n}명",
  "accred.auto.hr1.ok": "{n}명 신고 이력 확인 · 임박 없음",
  "accred.auto.mr1.over": "보존기간 경과 {n}건 (점검 {t})",
  "accred.auto.mr1.ok": "경과 0건 (점검 {t})",
  "accred.auto.mr3.bad": "분류 오류 {n}건 — 폐기 심의 전 정정",
  "accred.auto.mr3.ok": "점검 이력 있음 · {n}건 ({t})",
  "accred.auto.mr3.ledger": "파기 대장 {n}건 (최근 {t}) — 폐기 심의 증빙",
  "accred.auto.mr3.noLedger": "보존기간 경과 {n}건 (점검 {t}) — 파기 대장 없음",
  "accred.auto.mr4.none": "KCD 정비 미실시 — 청구 › 상병 정비에서 상병코드를 점검하세요",
  "accred.auto.mr4.stale": "마지막 정비 {t} — 분기 점검 주기 경과",
  "accred.auto.mr4.open": "미수록 {m}건 · 검토 {r}건 남음",
  "accred.auto.mr4.ok": "최근 정비 {t} · 미해결 없음",
  "accred.auto.pr2.none": "비급여 단가표 없음 — 보고·기록 › 비급여 보고에서 단가를 입력하세요",
  "accred.auto.pr2.noDate": "단가 {n}개 항목 · 적용일 미입력",
  "accred.auto.pr2.ok": "단가 {n}개 항목 · 적용일 {d}"
};
