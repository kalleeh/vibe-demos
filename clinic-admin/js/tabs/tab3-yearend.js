/* clinic-admin — Tab 03 · 연말정산 의료비 자료 사전점검 */
import { $, esc, fmtKRW, todayISO, setStatus, bindDrop } from "../core/ui.js";
import { ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, downloadCSV } from "../core/files.js";
import { checkRRN, maskRRN } from "./reporting-shared.js";

/* ─────────────────────────────────────────────────────────
   Tab 3 — 연말정산 의료비 자료 사전점검
   Validates an EMR export row by row BEFORE the hospital submits
   간소화 자료 (홈택스 or the EMR's 국세청 module). Nothing here is a
   submission format; the output is a 사전점검 정리표.
   주민등록번호 is parsed in memory only — never persisted, always masked.
   ───────────────────────────────────────────────────────── */
export function initTab3() {
  let lastRows = null;

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

      if (rrn.level !== "ok") add(rrn.level, "주민등록번호", rrn.msg);
      if (!date) add("error", "진료일자", "날짜 형식 인식 불가 (YYYY-MM-DD)");
      else if (+date.slice(0, 4) !== taxYear) add("error", "진료일자", `과세연도(${taxYear}) 외 진료일`);
      for (const [label, a] of [["본인부담금", own], ["비급여금액", non], ["의료비총액", tot]]) {
        if (a.missing) continue;
        if (isNaN(a.value)) add("error", label, "숫자가 아닌 금액");
        else if (a.value < 0) add("error", label, `음수 금액 (${fmtKRW(a.value)})`);
      }
      const ownV = isNaN(own.value) ? 0 : Math.max(0, own.value);
      const nonV = isNaN(non.value) ? 0 : Math.max(0, non.value);
      if (own.missing && non.missing) add("warn", "금액", "본인부담금·비급여금액 모두 비어 있음");
      let totalV = ownV + nonV;
      if (!tot.missing && !isNaN(tot.value) && tot.value >= 0) {
        totalV = tot.value;
        if (ownV + nonV > tot.value) add("error", "의료비총액", `본인부담금 + 비급여 (${fmtKRW(ownV + nonV)}) > 총액 (${fmtKRW(tot.value)})`);
      }
      if (rrn.digits.length === 13 && date) {
        const key = `${rrn.digits}|${date}|${ownV}|${nonV}`;
        if (seen.has(key)) add("warn", "중복", `${seen.get(key)}행과 동일 (주민번호·진료일·금액)`);
        else seen.set(key, n);
      }

      const worst = rowIssues.some(i => i.level === "error") ? "오류" : rowIssues.some(i => i.level === "warn") ? "주의" : "정상";
      out.push({
        "사업자등록번호": biz,
        "행": n,
        "환자성명": name,
        "주민등록번호(마스크)": masked,
        "진료일자": date || String(pick(row, ["진료일자", "진료일", "일자"])),
        "의료비총액": totalV,
        "본인부담금": ownV,
        "비급여금액": nonV,
        "점검결과": worst,
        "점검내용": rowIssues.map(i => `${i.field}: ${i.msg}`).join(" / ")
      });

      // Per-patient totals (keyed by RRN digits when usable, else by name)
      const pk = rrn.digits.length === 13 ? rrn.digits : `name:${name}`;
      const p = patients.get(pk) || { name, masked, count: 0, total: 0, own: 0, non: 0, errors: 0 };
      p.count++; p.total += totalV; p.own += ownV; p.non += nonV;
      if (worst === "오류") p.errors++;
      patients.set(pk, p);
    });
    return { rows: out, issues, patients: [...patients.values()], taxYear };
  };

  const render = ({ rows, issues, patients, taxYear }) => {
    const total = rows.reduce((s, r) => s + (r["의료비총액"] || 0), 0);
    const errs = issues.filter(i => i.level === "error").length;
    const warns = issues.filter(i => i.level === "warn").length;
    $("#ye-summary").innerHTML =
      `<strong>${rows.length}건</strong> · 총 의료비 <strong>${fmtKRW(total)}원</strong> · 오류 <strong>${errs}</strong> · 주의 <strong>${warns}</strong> · 과세연도 ${taxYear}`;
    $("#ye-toolbar").style.display = "flex";
    $("#ye-download").disabled = false;

    const pill = (lvl) => lvl === "error" ? `<span class="pill err">오류</span>` : `<span class="pill warn">주의</span>`;
    const issueTable = issues.length ? `
      <h5 class="ye-subhead">점검 결과 — ${errs}개 오류 · ${warns}개 주의</h5>
      <table class="ye-issues">
        <thead><tr><th class="code">행</th><th>환자</th><th class="code">주민번호</th><th>항목</th><th>내용</th><th>구분</th></tr></thead>
        <tbody>${issues.map(i => `<tr class="${i.level === "error" ? "row-err" : "row-warn"}">
          <td class="code">${i.row}</td><td>${esc(i.name)}</td><td class="code">${esc(i.masked)}</td>
          <td>${esc(i.field)}</td><td>${esc(i.msg)}</td><td>${pill(i.level)}</td></tr>`).join("")}
        </tbody>
      </table>` : `<div class="status-line" style="display:flex"><span class="dot"></span><span>행 단위 점검에서 오류·주의 항목이 없습니다.</span></div>`;

    const patientTable = `
      <h5 class="ye-subhead">환자별 합계 — ${patients.length}명</h5>
      <table>
        <thead><tr><th>환자</th><th class="code">주민번호</th><th class="code">건수</th><th class="code">본인부담</th><th class="code">비급여</th><th class="code">합계</th></tr></thead>
        <tbody>${patients.map(p => `<tr>
          <td>${esc(p.name)}${p.errors ? ` <span class="pill err">오류 ${p.errors}</span>` : ""}</td>
          <td class="code">${esc(p.masked)}</td>
          <td class="code" style="text-align:right">${p.count}</td>
          <td class="code" style="text-align:right">${fmtKRW(p.own)}</td>
          <td class="code" style="text-align:right">${fmtKRW(p.non)}</td>
          <td class="code" style="text-align:right">${fmtKRW(p.total)}</td></tr>`).join("")}
        </tbody>
      </table>`;

    const rowTable = `
      <h5 class="ye-subhead">정리표 — ${rows.length}행</h5>
      <table>
        <thead><tr>
          <th class="code">행</th><th>환자성명</th><th class="code">주민번호</th><th class="code">진료일자</th>
          <th class="code">총액</th><th class="code">본인부담</th><th class="code">비급여</th><th>점검</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td class="code">${r["행"]}</td>
            <td>${esc(r["환자성명"])}</td>
            <td class="code">${esc(r["주민등록번호(마스크)"])}</td>
            <td class="code">${esc(r["진료일자"])}</td>
            <td class="code" style="text-align:right">${fmtKRW(r["의료비총액"])}</td>
            <td class="code" style="text-align:right">${fmtKRW(r["본인부담금"])}</td>
            <td class="code" style="text-align:right">${fmtKRW(r["비급여금액"])}</td>
            <td><span class="pill ${r["점검결과"] === "오류" ? "err" : r["점검결과"] === "주의" ? "warn" : "ok"}">${esc(r["점검결과"])}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    $("#ye-result").innerHTML = issueTable + patientTable + rowTable;
  };

  const finish = (result, statusMsg) => {
    lastRows = result.rows;
    render(result);
    const errs = result.issues.filter(i => i.level === "error").length;
    setStatus($("#ye-status"), errs ? "err" : null, statusMsg(errs));
  };

  bindDrop("drop-ye", async (file) => {
    try {
      setStatus($("#ye-status"), null, `파일을 읽는 중 — ${esc(file.name)}`);
      const rows = await readSpreadsheet(file);
      if (!rows.length) {
        setStatus($("#ye-status"), "warn", "빈 파일입니다.");
        return;
      }
      const result = validate(rows);
      ActivityLog.push("yearend", `의료비 사전점검 — ${result.rows.length}건 (오류 ${result.issues.filter(i => i.level === "error").length})`, { file: file.name });
      finish(result, (errs) => errs
        ? `${result.rows.length}건 점검 — 오류 ${errs}건. 정정 후 EMR·홈택스에서 자료를 제출하세요. 주민등록번호는 마스킹만 표시되고 저장되지 않습니다.`
        : `${result.rows.length}건 점검 완료 — 행 단위 오류 없음. 사전점검 정리표를 내려받을 수 있습니다.`);
    } catch (err) {
      setStatus($("#ye-status"), "err", "파일을 읽지 못했습니다.");
    }
  });

  $("#ye-download").addEventListener("click", () => {
    if (!lastRows) return;
    const biz = ($("#ye-biz").value || "biz").replace(/-/g, "");
    downloadCSV(lastRows, `의료비_사전점검_정리표_${biz}_${todayISO().replace(/-/g, "")}.csv`); // watermark + _PoC applied inside
    ActivityLog.push("yearend", `의료비 사전점검 정리표 내려받음 (${lastRows.length}행)`, {});
  });

  // Sample: dates follow the selected tax year; the checksum-valid numbers pass, and the
  // set deliberately contains one bad RRN, one negative amount and one duplicate row.
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
    downloadXLSX(sampleYeData(), `샘플_진료기록_${$("#ye-year").value || ""}.xlsx`, "샘플");
  });

  $('[data-action="run-ye"]').addEventListener("click", () => {
    if (!$("#ye-biz").value.trim()) $("#ye-biz").value = "123-45-67890";
    if (!$("#ye-clinic").value.trim()) $("#ye-clinic").value = "한솔 한방병원";
    const result = validate(sampleYeData());
    ActivityLog.push("yearend", `의료비 사전점검 시연 — ${result.rows.length}건`, { sample: true });
    finish(result, (errs) =>
      `샘플 환자 4명 · 6건 — 주민번호 자릿수 오류, 음수 금액, 중복 행이 섞인 데이터로 사전점검 흐름을 보여드립니다 (오류 ${errs}건). 주민등록번호는 자동 마스킹.`);
  });

  // Persist hospital info fields (never the uploaded rows)
  if (!$("#ye-year").value) $("#ye-year").value = String(new Date().getFullYear() - 1);
  ["ye-biz", "ye-clinic", "ye-year"].forEach(id => bindPersist("#" + id, "yearend." + id));
}
