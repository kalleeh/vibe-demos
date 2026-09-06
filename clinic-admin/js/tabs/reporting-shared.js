/* clinic-admin — helpers shared by the reporting tabs (03 연말정산 today; 00/04 read the calendar
   from core/calendar.js, redaction + PoC watermark come from core/dom.js + core/files.js).
   Sits in the `tabs` layer of the import graph (dom → … → files → tabs); never imports shell.js. */

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
