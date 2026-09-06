/* clinic-admin — statutory reporting calendar shared by 00 오늘, 04 비급여 and the topbar due chip.
   Leaf module (imports nothing). Sits in core so shell.js and the tabs read ONE set of dates. */

/* 비급여 보고 (의료법 §45조의2 · 고시 「비급여 진료비용 등의 보고 및 공개에 관한 기준」):
   reference months March / September, submission windows April / October.
   Confidence: medium — 병원급 reports twice a year (의원급 once, March data only);
   exact open/close days are set by the annual 심평원 notice, hence "확인 필요" in the UI. */
export const BIGEUP_WINDOWS = [
  { key: "bigeup-h1", refMonth: 3, month: 4,  label: "비급여 보고 기간 — 3월분 (확인 필요)" },
  { key: "bigeup-h2", refMonth: 9, month: 10, label: "비급여 보고 기간 — 9월분 (확인 필요)" }
];

/* 연말정산 간소화 의료비 자료 제출 — 소득세법 시행령 §216조의3: 다음 연도 1월 13일까지.
   Confidence: medium-high on the law text; 국세청 publishes the practical window each year
   (간소화 서비스 opens 1월 15일, 수정·추가 제출 window follows), hence "확인 필요". */
export const YEAREND_DEADLINE = { key: "yearend", month: 1, day: 13, label: "국세청 의료비 간소화 자료 제출 기한 (확인 필요)" };

// Last day of a month as yyyy-mm-dd.
export function monthEndISO(y, m) {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

// Next occurrence (today inclusive) of a recurring month/day; `day` null → month end.
export function nextOccurrence(month, day, now = new Date()) {
  const y = now.getFullYear();
  const iso = (yy) => day ? `${yy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : monthEndISO(yy, month);
  const todayISO = `${y}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return iso(y) >= todayISO ? iso(y) : iso(y + 1);
}

// The recurring statutory deadlines as { key, title, date, link, source } for the next 12 months.
export function statutoryDeadlines(now = new Date()) {
  return [
    ...BIGEUP_WINDOWS.map(w => ({
      key: w.key, title: w.label, date: nextOccurrence(w.month, null, now),
      link: "tab-bigeup", source: `${w.refMonth}월 진료분 · 의료법 §45조의2 · 비급여 보고 고시`
    })),
    { key: YEAREND_DEADLINE.key, title: YEAREND_DEADLINE.label,
      date: nextOccurrence(YEAREND_DEADLINE.month, YEAREND_DEADLINE.day, now),
      link: "tab-yearend", source: "소득세법 시행령 §216조의3 · 홈택스" }
  ];
}
