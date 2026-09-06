/* clinic-admin — spreadsheet read (SheetJS, vendored global XLSX), XLSX/CSV download, JSON fetch
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { Toast } from "./ui.js";

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
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(","))
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export { loadJSON, readSpreadsheet, downloadXLSX, downloadCSV };
