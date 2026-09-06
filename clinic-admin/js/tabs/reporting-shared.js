/* clinic-admin — helpers shared by the reporting tabs (00 · 03 · 04 · 05 · 08 · 09).
   Sits in the `tabs` layer of the import graph (dom → … → files → tabs); never imports shell.js. */

// TODO(coordinator): replace with core import — `import { redactSubject } from "../core/dom.js"`.
// Same signature as the core helper: { name, pid } → short redacted label, never the raw name.
// 김민지 → 김○○ · P-2014-0042 → P-2014-****
export function redactSubject({ name, pid } = {}) {
  const n = String(name ?? "").trim();
  const p = String(pid ?? "").trim();
  const parts = [];
  if (n) parts.push(n.length <= 1 ? n + "○" : n[0] + "○".repeat(Math.min(n.length - 1, 3)));
  if (p) parts.push(p.length <= 4 ? "****" : p.slice(0, -4) + "****");
  return parts.join(" · ") || "—";
}

// TODO(coordinator): replace with core import — `import { pocWatermark } from "../core/files.js"`.
// One-line PoC notice stamped on every downloadable / printable artefact.
export function pocWatermark() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `PoC 시연용 자료 — 실제 제출·보고용 아님 · 생성 ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Append the watermark as a trailing row so CSV/XLSX exports carry it (first column, rest blank).
export function withWatermarkRow(rows) {
  if (!rows.length) return rows;
  const first = Object.keys(rows[0])[0];
  return [...rows, { [first]: pocWatermark() }];
}

/* Statutory reporting windows shared by 00 오늘 and 04 비급여.
   비급여 보고 (의료법 §45조의2 · 고시 「비급여 진료비용 등의 보고 및 공개에 관한 기준」):
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

/* 주민등록번호 — 13 digits + weighted checksum (2,3,4,5,6,7,8,9,2,3,4,5 mod 11).
   Confidence: high on the historical algorithm. Since 2020-10 new numbers carry random
   trailing digits with NO checksum, and 외국인등록번호 use a different rule — so a checksum
   miss is a WARNING, only a wrong length is an error. */
export function checkRRN(raw) {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (d.length !== 13) return { digits: d, level: "error", msg: `주민등록번호 ${d.length}자리 (13자리 필요)` };
  const mm = +d.slice(2, 4), dd = +d.slice(4, 6);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { digits: d, level: "error", msg: "생년월일 자리(MMDD) 범위 오류" };
  const W = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = W.reduce((s, w, i) => s + w * +d[i], 0);
  const check = (11 - (sum % 11)) % 10;
  if (check !== +d[12]) return { digits: d, level: "warn", msg: "검증식 불일치 — 2020.10 이후 발급분·외국인등록번호는 정상일 수 있음" };
  return { digits: d, level: "ok", msg: "" };
}

// 880314-2123456 → 880314-2******  (never render more than the first 7 digits)
export function maskRRN(raw) {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!d) return "";
  return d.slice(0, 6) + "-" + (d[6] || "") + "******";
}
