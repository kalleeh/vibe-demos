/* clinic-admin — Tab 03 · 연말정산 의료비 자료 사전점검 */
import { $, esc, fmtKRW, won, todayISO, setStatus, bindDrop } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, downloadCSV, headerRow } from "../core/files.js";
import { checkRRN, maskRRN } from "./reporting-shared.js";

/* ─────────────────────────────────────────────────────────
   Tab 3 — 연말정산 의료비 자료 사전점검
   Validates an EMR export row by row BEFORE the hospital submits
   간소화 자료 (홈택스 or the EMR's 국세청 module). Nothing here is a
   submission format; the output is a 사전점검 정리표.
   주민등록번호 is parsed in memory only — never persisted, always masked.
   i18n: rows keep neutral fields + [key, vars] issue messages so the tables, the status line and the CSV
   headers re-render from `lastResult` in either language.
   ───────────────────────────────────────────────────────── */
export function initTab3() {
  let lastResult = null, lastStatus = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#ye-status"), kind, fn()); };

  const pick = (row, keys) => { for (const k of keys) if (row[k] != null && row[k] !== "") return row[k]; return ""; };
  const parseAmount = (v) => {
    if (v == null || v === "") return { value: 0, missing: true };
    const s = String(v).replace(/[^0-9.\-]/g, "");
    if (s === "" || s === "-" || isNaN(+s)) return { value: NaN, missing: false };
    return { value: +s, missing: false };
  };
  const parseDate = (v) => {
    const s = String(v ?? "").trim();
    const m = s.match(/^(\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})/);
    if (!m) return null;
    const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? null : iso;
  };
  // field / message resolvers — issues store { level, field: fieldKey, msg: [key, vars] | string }
  const fieldText = (f) => t("yearend.f." + f);
  const msgText = (m) => Array.isArray(m) ? t(m[0], m[1]) : String(m ?? "");
  const verdictText = (lvl) => t("yearend.v." + lvl);

  // Returns { rows, issues, patients, taxYear }.
  const validate = (rows) => {
    const biz = $("#ye-biz").value.trim();
    const taxYear = +$("#ye-year").value || new Date().getFullYear() - 1;
    const out = [], issues = [], seen = new Map(), patients = new Map();
    rows.forEach((row, idx) => {
      const n = idx + 2; // spreadsheet row number (header = 1)
      const name = String(pick(row, ["환자성명", "성명", "환자명"])).trim();
      const rrnRaw = pick(row, ["주민등록번호", "주민번호"]);
      const rrn = checkRRN(rrnRaw);
      const masked = maskRRN(rrnRaw);
      const date = parseDate(pick(row, ["진료일자", "진료일", "일자"]));
      const own = parseAmount(pick(row, ["본인부담금", "본인부담"]));
      const non = parseAmount(pick(row, ["비급여금액", "비급여"]));
      const tot = parseAmount(pick(row, ["의료비총액", "총진료비", "총액"]));
      const rowIssues = [];
      const add = (level, field, msg) => { rowIssues.push({ level, field, msg }); issues.push({ row: n, name, masked, level, field, msg }); };

      if (rrn.level !== "ok") add(rrn.level, "rrn", rrn.msgKey ? [rrn.msgKey, rrn.vars] : rrn.msg);
      if (!date) add("error", "date", ["yearend.msgDateFormat"]);
      else if (+date.slice(0, 4) !== taxYear) add("error", "date", ["yearend.msgOutOfYear", { y: taxYear }]);
      for (const [field, a] of [["own", own], ["non", non], ["total", tot]]) {
        if (a.missing) continue;
        if (isNaN(a.value)) add("error", field, ["yearend.msgNotNumber"]);
        else if (a.value < 0) add("error", field, ["yearend.msgNegative", { amt: fmtKRW(a.value) }]);
      }
      const ownV = isNaN(own.value) ? 0 : Math.max(0, own.value);
      const nonV = isNaN(non.value) ? 0 : Math.max(0, non.value);
      if (own.missing && non.missing) add("warn", "amount", ["yearend.msgBothEmpty"]);
      let totalV = ownV + nonV;
      if (!tot.missing && !isNaN(tot.value) && tot.value >= 0) {
        totalV = tot.value;
        if (ownV + nonV > tot.value) add("error", "total", ["yearend.msgSumGtTotal", { s: fmtKRW(ownV + nonV), tot: fmtKRW(tot.value) }]);
      }
      if (rrn.digits.length === 13 && date) {
        const key = `${rrn.digits}|${date}|${ownV}|${nonV}`;
        if (seen.has(key)) add("warn", "dup", ["yearend.msgDup", { row: seen.get(key) }]);
        else seen.set(key, n);
      }

      const worst = rowIssues.some(i => i.level === "error") ? "error" : rowIssues.some(i => i.level === "warn") ? "warn" : "ok";
      out.push({ biz, row: n, name, masked, date: date || String(pick(row, ["진료일자", "진료일", "일자"])), total: totalV, own: ownV, non: nonV, verdict: worst, issues: rowIssues });

      // Per-patient totals (keyed by RRN digits when usable, else by name)
      const pk = rrn.digits.length === 13 ? rrn.digits : `name:${name}`;
      const p = patients.get(pk) || { name, masked, count: 0, total: 0, own: 0, non: 0, errors: 0 };
      p.count++; p.total += totalV; p.own += ownV; p.non += nonV;
      if (worst === "error") p.errors++;
      patients.set(pk, p);
    });
    return { rows: out, issues, patients: [...patients.values()], taxYear };
  };
  const rowNotes = (r) => r.issues.map(i => `${fieldText(i.field)}: ${msgText(i.msg)}`).join(" / ");

  const render = ({ rows, issues, patients, taxYear }) => {
    const total = rows.reduce((s, r) => s + (r.total || 0), 0);
    const errs = issues.filter(i => i.level === "error").length;
    const warns = issues.filter(i => i.level === "warn").length;
    $("#ye-summary").innerHTML = t("yearend.summary", { n: rows.length, total: won(total), e: errs, w: warns, y: taxYear });
    $("#ye-toolbar").style.display = "flex";
    $("#ye-download").disabled = false;

    const pill = (lvl) => lvl === "error" ? `<span class="pill err">${esc(verdictText("error"))}</span>` : `<span class="pill warn">${esc(verdictText("warn"))}</span>`;
    const issueTable = issues.length ? `
      <h5 class="ye-subhead">${esc(t("yearend.issuesH", { e: errs, w: warns }))}</h5>
      <table class="ye-issues">
        <thead><tr><th class="code">${esc(t("yearend.thRow"))}</th><th>${esc(t("yearend.thPatient"))}</th><th class="code">${esc(t("yearend.thRrn"))}</th><th>${esc(t("yearend.thField"))}</th><th>${esc(t("yearend.thDetail"))}</th><th>${esc(t("yearend.thLevel"))}</th></tr></thead>
        <tbody>${issues.map(i => `<tr class="${i.level === "error" ? "row-err" : "row-warn"}">
          <td class="code">${i.row}</td><td>${esc(i.name)}</td><td class="code">${esc(i.masked)}</td>
          <td>${esc(fieldText(i.field))}</td><td>${esc(msgText(i.msg))}</td><td>${pill(i.level)}</td></tr>`).join("")}
        </tbody>
      </table>` : `<div class="status-line" style="display:flex"><span class="dot"></span><span>${esc(t("yearend.noIssues"))}</span></div>`;

    const patientTable = `
      <h5 class="ye-subhead">${esc(t("yearend.patientsH", { n: patients.length }))}</h5>
      <table>
        <thead><tr><th>${esc(t("yearend.thPatient"))}</th><th class="code">${esc(t("yearend.thRrn"))}</th><th class="code">${esc(t("yearend.thCount"))}</th><th class="code">${esc(t("yearend.thOwn"))}</th><th class="code">${esc(t("yearend.thNon"))}</th><th class="code">${esc(t("yearend.thSum"))}</th></tr></thead>
        <tbody>${patients.map(p => `<tr>
          <td>${esc(p.name)}${p.errors ? ` <span class="pill err">${esc(t("yearend.errBadge", { n: p.errors }))}</span>` : ""}</td>
          <td class="code">${esc(p.masked)}</td>
          <td class="code" style="text-align:right">${p.count}</td>
          <td class="code" style="text-align:right">${fmtKRW(p.own)}</td>
          <td class="code" style="text-align:right">${fmtKRW(p.non)}</td>
          <td class="code" style="text-align:right">${fmtKRW(p.total)}</td></tr>`).join("")}
        </tbody>
      </table>`;

    const rowTable = `
      <h5 class="ye-subhead">${esc(t("yearend.sheetH", { n: rows.length }))}</h5>
      <table>
        <thead><tr>
          <th class="code">${esc(t("yearend.thRow"))}</th><th>${esc(t("yearend.thName"))}</th><th class="code">${esc(t("yearend.thRrn"))}</th><th class="code">${esc(t("jabo.fDate"))}</th>
          <th class="code">${esc(t("yearend.thTotal"))}</th><th class="code">${esc(t("yearend.thOwn"))}</th><th class="code">${esc(t("yearend.thNon"))}</th><th>${esc(t("yearend.thCheck"))}</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td class="code">${r.row}</td>
            <td>${esc(r.name)}</td>
            <td class="code">${esc(r.masked)}</td>
            <td class="code">${esc(r.date)}</td>
            <td class="code" style="text-align:right">${fmtKRW(r.total)}</td>
            <td class="code" style="text-align:right">${fmtKRW(r.own)}</td>
            <td class="code" style="text-align:right">${fmtKRW(r.non)}</td>
            <td><span class="pill ${r.verdict === "error" ? "err" : r.verdict === "warn" ? "warn" : "ok"}">${esc(verdictText(r.verdict))}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    $("#ye-result").innerHTML = issueTable + patientTable + rowTable;
  };

  const finish = (result, statusFn) => {
    lastResult = result;
    render(result);
    const errs = result.issues.filter(i => i.level === "error").length;
    status(errs ? "err" : null, () => statusFn(errs));
  };

  bindDrop("drop-ye", async (file) => {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) {
        status("warn", () => t("common.statusEmptyFileShort"));
        return;
      }
      const result = validate(rows);
      ActivityLog.push("yearend", t("yearend.logRun", { n: result.rows.length, e: result.issues.filter(i => i.level === "error").length }), { file: file.name });
      finish(result, (errs) => errs
        ? t("yearend.statusErrs", { n: result.rows.length, e: errs })
        : t("yearend.statusOk", { n: result.rows.length }));
    } catch (err) {
      status("err", () => t("common.statusReadFailShort"));
    }
  });

  $("#ye-download").addEventListener("click", () => {
    if (!lastResult) return;
    const biz = ($("#ye-biz").value || "biz").replace(/-/g, "");
    const rows = lastResult.rows.map(r => headerRow([
      ["yearend.col.biz", r.biz], ["yearend.col.row", r.row], ["yearend.col.name", r.name], ["yearend.col.rrn", r.masked], ["yearend.col.date", r.date],
      ["yearend.col.total", r.total], ["yearend.col.own", r.own], ["yearend.col.non", r.non], ["yearend.col.verdict", verdictText(r.verdict)], ["yearend.col.notes", rowNotes(r)]
    ]));
    downloadCSV(rows, t("yearend.file", { biz, date: todayISO().replace(/-/g, "") })); // watermark + _PoC applied inside
    ActivityLog.push("yearend", t("yearend.logDl", { n: rows.length }), {});
  });

  // Sample: dates follow the selected tax year; the checksum-valid numbers pass, and the
  // set deliberately contains one bad RRN, one negative amount and one duplicate row.
  // Column headers are the Korean EMR-export names the validator expects (data, not UI copy).
  const sampleYeData = () => {
    const y = +$("#ye-year").value || new Date().getFullYear() - 1;
    return [
      { 환자성명: "김민지", 주민등록번호: "880314-2123458", 진료일자: `${y}-04-08`, 본인부담금: 12000, 비급여금액: 38000 },
      { 환자성명: "김민지", 주민등록번호: "880314-2123458", 진료일자: `${y}-04-15`, 본인부담금: 12000, 비급여금액: 0     },
      { 환자성명: "박지훈", 주민등록번호: "750822-1234569", 진료일자: `${y}-06-02`, 본인부담금: 18000, 비급여금액: 80000 },
      { 환자성명: "박지훈", 주민등록번호: "750822-1234569", 진료일자: `${y}-06-02`, 본인부담금: 18000, 비급여금액: 80000 },
      { 환자성명: "이서윤", 주민등록번호: "920506-265432",  진료일자: `${y}-08-21`, 본인부담금: 15000, 비급여금액: 120000 },
      { 환자성명: "최다은", 주민등록번호: "010912-4123452", 진료일자: `${y}-09-03`, 본인부담금: -9000, 비급여금액: 45000 }
    ];
  };

  $('[data-action="sample-ye"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleYeData(), t("yearend.sampleFile", { y: $("#ye-year").value || "" }), t("common.sampleSheetShort"));
  });

  $('[data-action="run-ye"]').addEventListener("click", () => {
    if (!$("#ye-biz").value.trim()) $("#ye-biz").value = "123-45-67890";
    if (!$("#ye-clinic").value.trim()) $("#ye-clinic").value = "한솔 한방병원";
    const result = validate(sampleYeData());
    ActivityLog.push("yearend", t("yearend.logSample", { n: result.rows.length }), { sample: true });
    finish(result, (errs) => t("yearend.statusSample", { e: errs }));
  });

  // Persist hospital info fields (never the uploaded rows)
  if (!$("#ye-year").value) $("#ye-year").value = String(new Date().getFullYear() - 1);
  ["ye-biz", "ye-clinic", "ye-year"].forEach(id => bindPersist("#" + id, "yearend." + id));

  onLangChange(() => {
    if (lastResult) render(lastResult);
    if (lastStatus) setStatus($("#ye-status"), lastStatus.kind, lastStatus.fn());
  });
}
