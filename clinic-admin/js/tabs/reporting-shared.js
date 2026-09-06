/* clinic-admin — helpers shared by the reporting tabs (03 연말정산 today; 00/04 read the calendar
   from core/calendar.js, redaction + PoC watermark come from core/dom.js + core/files.js).
   Sits in the `tabs` layer of the import graph (dom → … → files → tabs); never imports shell.js. */
import { t } from "../core/i18n.js";

/* 주민등록번호 — 13 digits + weighted checksum (2,3,4,5,6,7,8,9,2,3,4,5 mod 11).
   Confidence: high on the historical algorithm. Since 2020-10 new numbers carry random
   trailing digits with NO checksum, and 외국인등록번호 use a different rule — so a checksum
   miss is a WARNING, only a wrong length is an error. */
// Returns { digits, level, msg, msgKey, vars } — msgKey/vars let the caller re-translate on a language swap.
export function checkRRN(raw) {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  const out = (level, msgKey, vars) => ({ digits: d, level, msgKey, vars, msg: msgKey ? t(msgKey, vars) : "" });
  if (d.length !== 13) return out("error", "yearend.rrnLen", { n: d.length });
  const mm = +d.slice(2, 4), dd = +d.slice(4, 6);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return out("error", "yearend.rrnMmdd");
  const W = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = W.reduce((s, w, i) => s + w * +d[i], 0);
  const check = (11 - (sum % 11)) % 10;
  if (check !== +d[12]) return out("warn", "yearend.rrnChecksum");
  return out("ok", null);
}

// 880314-2123456 → 880314-2******  (never render more than the first 7 digits)
export function maskRRN(raw) {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!d) return "";
  return d.slice(0, 6) + "-" + (d[6] || "") + "******";
}
