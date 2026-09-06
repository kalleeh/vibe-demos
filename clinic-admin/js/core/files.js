/* clinic-admin — spreadsheet read (SheetJS, vendored global XLSX), XLSX/CSV download, JSON fetch

   PoC WATERMARK (security pass): every file this app produces must carry
     "PoC — 실제 제출 불가 · 데모 데이터"   (English UI: "PoC — not for real submission · demo data")
   downloadXLSX / downloadCSV apply pocWatermark() themselves, so existing callers are covered.
   Anything that builds its own Blob (e.g. an .ics) should call
     const { rows, filename } = pocWatermark(rows, filename)   // rows may be [] / null
   or at least use pocMark() + pocFilename(). The @media print footer lives in styles-security.css.
   POC_MARK (the Korean constant) stays exported for file-format fields that must not vary by UI language
   (the encrypted backup's `poc` field); every user-facing surface uses pocMark(). */
/* global XLSX */
import { Toast, esc } from "./ui.js";
import { t } from "./i18n.js";
import { Org } from "./entities.js";

const POC_MARK = "PoC — 실제 제출 불가 · 데모 데이터";
const pocMark = () => t("common.pocMark");
const isPocMark = (v) => v === POC_MARK || v === pocMark();

// "자보정산_0142_2026-09-06.xlsx" → "자보정산_0142_2026-09-06_PoC.xlsx"
function pocFilename(filename) {
  const s = String(filename || "download");
  if (/_PoC(\.[^.]+)?$/.test(s)) return s;
  const i = s.lastIndexOf(".");
  return i > 0 ? `${s.slice(0, i)}_PoC${s.slice(i)}` : `${s}_PoC`;
}
// Prefix a watermark row (first column carries the text, other columns empty) + suffix the filename.
function pocWatermark(rows, filename) {
  const list = Array.isArray(rows) ? rows : [];
  const headers = list.length ? Object.keys(list[0]) : [t("common.thNote")];
  if (list.length && isPocMark(list[0][headers[0]])) return { rows: list, filename: pocFilename(filename) };
  const mark = Object.fromEntries(headers.map((h, i) => [h, i === 0 ? pocMark() : ""]));
  return { rows: [mark, ...list], filename: pocFilename(filename) };
}

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed: ${path}`);
  return r.json();
}

function readSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === "undefined") {
          Toast.show({ tag: "system", html: esc(t("common.xlsxMissing")) });
          throw new Error("xlsx-missing");
        }
        const data = new Uint8Array(e.target.result);
        // cellDates:true → Excel date cells come back as JS Dates instead of
        // 45xxx serials. They are then normalised to local "yyyy-mm-dd" here,
        // because sheet_to_json's dateNF is ignored whenever the cell carries
        // its own number format (which every real EMR export does — you'd get
        // "12/10/25" or "2025년 12월 10일" depending on the file's locale).
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const pad = (n) => String(n).padStart(2, "0");
        const ymd = (d) => isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }).map(row => {
          for (const k in row) if (row[k] instanceof Date) row[k] = ymd(row[k]);
          return row;
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function downloadXLSX(rows, filename, sheetName = "Sheet1") {
  const wm = pocWatermark(rows, filename);
  const ws = XLSX.utils.json_to_sheet(wm.rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, wm.filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const wm = pocWatermark(rows, filename);
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [
    headers.join(","),
    ...wm.rows.map(r => headers.map(h => escape(r[h])).join(","))
  ].join("\n");
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), wm.filename);
}

// Plain-text download (JSON backups etc.) — filename watermarked, content left to the caller.
function downloadText(text, filename, type = "application/json") {
  downloadBlob(new Blob([text], { type }), pocFilename(filename));
}
// Build an export row from a header-key map: keys(kFn) → { [t(headerKey)]: value }. Lets every tab keep
// neutral internal field names while the sheet headers follow the UI language.
function headerRow(pairs) {
  const out = {};
  for (const [headerKey, value] of pairs) out[t(headerKey)] = value;
  return out;
}
// Institution columns for an export's header row, from the shared Org profile (core/entities.js):
//   headerRow([...orgHeader(), ["jabo.col.stmt", r.stmt], …])  →  { 기관명: "한솔한방병원", 요양기관기호: "11000123", … }
// `fields` picks a subset in order (default: name · ykiho · biz); values are "" while the profile is incomplete.
function orgHeader(fields = ["name", "ykiho", "biz"]) {
  const o = Org.get();
  return fields.filter(f => f in o).map(f => [`org.col.${f}`, o[f]]);
}
export { POC_MARK, pocMark, pocFilename, pocWatermark, loadJSON, readSpreadsheet, downloadXLSX, downloadCSV, downloadText, headerRow, orgHeader };
