/* clinic-admin — spreadsheet read (SheetJS, vendored global XLSX), XLSX/CSV download, JSON fetch

   PoC WATERMARK (security pass): every file this app produces must carry
     "PoC — 실제 제출 불가 · 데모 데이터"
   downloadXLSX / downloadCSV apply pocWatermark() themselves, so existing callers are covered.
   Anything that builds its own Blob (e.g. an .ics) should call
     const { rows, filename } = pocWatermark(rows, filename)   // rows may be [] / null
   or at least use POC_MARK + pocFilename(). The @media print footer lives in styles-security.css. */
import { Toast } from "./ui.js";

const POC_MARK = "PoC — 실제 제출 불가 · 데모 데이터";

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
  const headers = list.length ? Object.keys(list[0]) : ["비고"];
  if (list.length && list[0][headers[0]] === POC_MARK) return { rows: list, filename: pocFilename(filename) };
  const mark = Object.fromEntries(headers.map((h, i) => [h, i === 0 ? POC_MARK : ""]));
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
          Toast.show({ tag: "system", html: "엑셀 라이브러리를 불러오지 못했습니다 — 페이지를 새로 고쳐주세요." });
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
export { POC_MARK, pocFilename, pocWatermark, loadJSON, readSpreadsheet, downloadXLSX, downloadCSV, downloadText };
