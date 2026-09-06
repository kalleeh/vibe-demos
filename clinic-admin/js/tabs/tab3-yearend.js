/* clinic-admin — Tab 03
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, fmtKRW, todayISO, setStatus, bindDrop } from "../core/ui.js";
import { ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, downloadCSV } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   Tab 3 — 연말정산 의료비 자료 빌더
   ───────────────────────────────────────────────────────── */
export function initTab3() {
  let lastRows = null;

  const transform = (rows) => {
    const biz = $("#ye-biz").value.trim();
    const evid = $("#ye-evid").value;
    const han = $("#ye-han").value;
    const out = [];
    for (const row of rows) {
      const rrn = String(row["주민등록번호"] || row["주민번호"] || "").replace(/[^0-9]/g, "");
      const masked = rrn.length >= 13 ? rrn.slice(0, 6) + "-" + rrn.slice(6, 7) + "******" : "";
      const date = String(row["진료일자"] || "").replace(/-/g, "");
      const own = +String(row["본인부담금"] || 0).replace(/[^0-9.]/g, "") || 0;
      const non = +String(row["비급여금액"] || 0).replace(/[^0-9.]/g, "") || 0;
      const tot = own + non;
      out.push({
        "사업자등록번호":       biz,
        "환자성명":             row["환자성명"] || row["성명"] || "",
        "주민등록번호(마스크)":   masked,
        "진료일자":             date,
        "의료비총액":           tot,
        "본인부담금":           own,
        "비급여금액":           non,
        "의료비공제대상금액":     own + non,
        "증빙코드":             evid,
        "한방여부":             han
      });
    }
    return out;
  };

  const render = (rows) => {
    const total = rows.reduce((s, r) => s + (r["의료비총액"] || 0), 0);
    $("#ye-summary").innerHTML =
      `<strong>${rows.length}건</strong> · 총 의료비 <strong>${fmtKRW(total)}원</strong>`;
    $("#ye-toolbar").style.display = "flex";
    $("#ye-download").disabled = false;

    $("#ye-result").innerHTML = `
      <table>
        <thead><tr>
          <th>환자성명</th><th class="code">주민번호</th><th class="code">진료일자</th>
          <th class="code">총액</th><th class="code">본인부담</th><th class="code">비급여</th>
          <th>한방</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${r["환자성명"]}</td>
            <td class="code">${r["주민등록번호(마스크)"]}</td>
            <td class="code">${r["진료일자"]}</td>
            <td class="code" style="text-align:right">${fmtKRW(r["의료비총액"])}</td>
            <td class="code" style="text-align:right">${fmtKRW(r["본인부담금"])}</td>
            <td class="code" style="text-align:right">${fmtKRW(r["비급여금액"])}</td>
            <td><span class="pill info">${r["한방여부"]}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  };

  bindDrop("drop-ye", async (file) => {
    try {
      setStatus($("#ye-status"), null, `파일을 읽는 중 — ${file.name}`);
      const rows = await readSpreadsheet(file);
      if (!rows.length) {
        setStatus($("#ye-status"), "warn", "빈 파일입니다.");
        return;
      }
      const result = transform(rows);
      lastRows = result;
      render(result);
      setStatus($("#ye-status"), null, `${result.length}건 검증 완료 · 홈택스 일괄제출 표준으로 변환했습니다. 주민등록번호는 자동 마스킹됩니다.`);
    } catch (err) {
      setStatus($("#ye-status"), "err", "파일을 읽지 못했습니다.");
    }
  });

  $("#ye-download").addEventListener("click", () => {
    if (!lastRows) return;
    const biz = ($("#ye-biz").value || "biz").replace(/-/g, "");
    downloadCSV(lastRows, `의료비_${biz}_${todayISO().replace(/-/g, "")}.csv`);
  });

  const sampleYeData = [
    { 환자성명: "김민지", 주민등록번호: "880314-2123456", 진료일자: "2025-04-08", 본인부담금: 12000, 비급여금액: 38000 },
    { 환자성명: "김민지", 주민등록번호: "880314-2123456", 진료일자: "2025-04-15", 본인부담금: 12000, 비급여금액: 0     },
    { 환자성명: "박지훈", 주민등록번호: "750822-1234567", 진료일자: "2025-06-02", 본인부담금: 18000, 비급여금액: 80000 },
    { 환자성명: "박지훈", 주민등록번호: "750822-1234567", 진료일자: "2025-06-09", 본인부담금: 9000,  비급여금액: 0     },
    { 환자성명: "이서윤", 주민등록번호: "920506-2654321", 진료일자: "2025-08-21", 본인부담금: 15000, 비급여금액: 120000 }
  ];

  $('[data-action="sample-ye"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleYeData, "샘플_진료기록_2025.xlsx", "샘플");
  });

  $('[data-action="run-ye"]').addEventListener("click", () => {
    if (!$("#ye-biz").value.trim()) $("#ye-biz").value = "123-45-67890";
    if (!$("#ye-clinic").value.trim()) $("#ye-clinic").value = "한솔 한방병원";
    const result = transform(sampleYeData);
    lastRows = result;
    render(result);
    ActivityLog.push("yearend", `연말정산 사전검증 시연 — ${result.length}건`, { sample: true });
    setStatus($("#ye-status"), null,
      "샘플 환자 3명 · 5건 진료 — PCC 미반영 비급여를 포함한 데이터로 일괄제출 사전검증을 마쳤습니다. 주민등록번호는 자동 마스킹.");
  });

  // Persist hospital info fields
  ["ye-biz", "ye-clinic", "ye-evid", "ye-han"].forEach(id => bindPersist("#" + id, "yearend." + id));
}
