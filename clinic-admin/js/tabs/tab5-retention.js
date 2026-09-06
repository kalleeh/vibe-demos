/* clinic-admin — Tab 05
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, todayISO, setStatus, bindDrop } from "../core/ui.js";
import { Store, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   Tab 5 — 의무기록 보존 감사
   ───────────────────────────────────────────────────────── */
export function initTab5(ctx) {
  const { DATA } = ctx;
  // render legal table
  $("#ret-table").innerHTML = DATA.retention.categories.map(c =>
    `<tr><td>${c.key}</td><td class="code">${c.years}년</td><td class="code" style="color:var(--muted)">의료법 시행규칙 §15</td></tr>`
  ).join("");

  let lastRows = null;
  const today = new Date(todayISO());

  const normalize = (typeStr) => {
    const s = (typeStr || "").trim();
    for (const c of DATA.retention.categories) {
      if (s === c.key) return c;
      if (c.aliases.some(a => a === s)) return c;
    }
    // fuzzy match
    for (const c of DATA.retention.categories) {
      if (s.includes(c.key) || c.key.includes(s)) return c;
    }
    return null;
  };

  const transform = (rows) => {
    const out = [];
    const stats = { ok: 0, soon: 0, over: 0, bad: 0 };
    for (const row of rows) {
      const id = row["기록ID"] || row["ID"] || "";
      const rawType = row["기록종류"] || row["종류"] || "";
      // Legal retention runs from the treatment-completion / last-visit date
      // (per retention.json), falling back to 작성일자 when that column is absent.
      const created = String(
        row["진료완료일"] || row["마지막진료일"] || row["작성일자"] || ""
      ).trim();
      const status = (row["상태"] || "active").trim();
      const cat = normalize(rawType);

      if (!cat) {
        stats.bad++;
        out.push({
          기록ID: id, 기록종류: rawType, 작성일자: created,
          법정보존기간_년: "?", 만료예정일: "—", 잔여일수: "—",
          감사결과: "분류 오류", 권고조치: "기록종류를 표준 9개 카테고리 중 하나로 정정"
        });
        continue;
      }

      const dt = new Date(created);
      if (isNaN(dt.getTime())) {
        stats.bad++;
        out.push({
          기록ID: id, 기록종류: cat.key, 작성일자: created,
          법정보존기간_년: cat.years, 만료예정일: "—", 잔여일수: "—",
          감사결과: "분류 오류", 권고조치: "작성일자 형식 확인 (YYYY-MM-DD)"
        });
        continue;
      }

      const expiry = new Date(dt);
      expiry.setFullYear(expiry.getFullYear() + cat.years);
      const remainingDays = Math.round((expiry - today) / 86400000);

      let verdict, note, kind;
      if (remainingDays < 0) {
        verdict = "만료 초과 (폐기 검토)"; kind = "over";
        note = `${-remainingDays}일 초과 — 안전 폐기 절차 검토`;
        stats.over++;
      } else if (remainingDays <= 180) {
        verdict = "만료 임박"; kind = "soon";
        note = `${remainingDays}일 후 만료 — 디지털 아카이브 권고`;
        stats.soon++;
      } else {
        verdict = "정상 보존"; kind = "ok";
        note = "—";
        stats.ok++;
      }

      out.push({
        기록ID: id, 기록종류: cat.key, 작성일자: created,
        법정보존기간_년: cat.years,
        만료예정일: expiry.toISOString().slice(0, 10),
        잔여일수: remainingDays,
        감사결과: verdict, 권고조치: note,
        _kind: kind
      });
    }
    return { rows: out, stats };
  };

  const render = (result) => {
    const { rows, stats } = result;
    $("#ret-stats").style.display = "grid";
    $("#ret-ok").textContent = stats.ok;
    $("#ret-soon").textContent = stats.soon;
    $("#ret-over").textContent = stats.over;
    $("#ret-bad").textContent = stats.bad;
    $("#ret-toolbar").style.display = "flex";
    $("#ret-summary").innerHTML = `<strong>${rows.length}건</strong> 감사 완료 · 즉시 조치 <strong>${stats.over + stats.bad}건</strong>`;
    $("#ret-download").disabled = false;

    // Sort: over → soon → bad → ok
    const sorted = [...rows].sort((a, b) => {
      const order = { over: 0, soon: 1, bad: 2, ok: 3 };
      return (order[a._kind] ?? 3) - (order[b._kind] ?? 3);
    });

    $("#ret-result").innerHTML = `
      <table>
        <thead><tr>
          <th>기록ID</th><th>기록종류</th><th class="code">작성일</th>
          <th class="code">보존(년)</th><th class="code">만료일</th>
          <th class="code">잔여일</th><th>결과</th>
        </tr></thead>
        <tbody>
          ${sorted.map(r => {
            const cls = r._kind === "over" ? "err"
                      : r._kind === "soon" ? "warn"
                      : r._kind === "bad"  ? "err"
                      : "ok";
            const label = r.감사결과;
            const remaining = r.잔여일수 === "—" ? "—"
              : (r.잔여일수 < 0 ? "+" + (-r.잔여일수) : r.잔여일수);
            return `<tr>
              <td class="code">${r.기록ID}</td>
              <td>${r.기록종류}</td>
              <td class="code">${r.작성일자}</td>
              <td class="code">${r.법정보존기간_년}</td>
              <td class="code">${r.만료예정일}</td>
              <td class="code" style="text-align:right">${remaining}</td>
              <td><span class="pill ${cls}">${label}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  };

  const persistRet = (result) => {
    Store.set("retention.lastAudit", {
      at: Date.now(),
      total: result.rows.length,
      ok: result.stats.ok,
      soon: result.stats.soon,
      over: result.stats.over,
      bad: result.stats.bad
    });
  };

  bindDrop("drop-ret", async (file) => {
    try {
      setStatus($("#ret-status"), null, `파일을 읽는 중 — ${file.name}`);
      const rows = await readSpreadsheet(file);
      if (!rows.length) {
        setStatus($("#ret-status"), "warn", "빈 파일입니다.");
        return;
      }
      const result = transform(rows);
      lastRows = result.rows.map(({_kind, ...rest}) => rest);
      render(result);
      persistRet(result);
      ActivityLog.push("retention", `보존 감사 — ${result.rows.length}건 (만료 ${result.stats.over}, 임박 ${result.stats.soon})`, { file: file.name });
      const urgent = result.stats.over + result.stats.bad;
      if (urgent > 0) {
        setStatus($("#ret-status"), "warn",
          `${urgent}건의 즉시 조치 항목이 있습니다.`);
      } else {
        setStatus($("#ret-status"), null,
          `${result.rows.length}건 모두 정상 보존 또는 단순 모니터링 단계입니다.`);
      }
    } catch (err) {
      setStatus($("#ret-status"), "err", "파일을 읽지 못했습니다.");
    }
  });

  $("#ret-download").addEventListener("click", () => {
    if (!lastRows) return;
    downloadXLSX(lastRows, `의무기록_보존감사_${todayISO()}.xlsx`, "보존 감사");
    ActivityLog.push("retention", `보존감사 보고서 내려받음 (${lastRows.length}건)`, {});
  });

  const sampleRetData = [
    { 기록ID: "REC-2014-0001", 기록종류: "진료기록부", 환자번호: "P-2014-0042", 작성일자: "2014-03-14", 상태: "active" },
    { 기록ID: "REC-2014-0002", 기록종류: "처방전",     환자번호: "P-2014-0042", 작성일자: "2014-03-14", 상태: "active" },
    { 기록ID: "REC-2020-0098", 기록종류: "방사선기록", 환자번호: "P-2020-0098", 작성일자: "2020-08-22", 상태: "archived" },
    { 기록ID: "REC-2021-0204", 기록종류: "검사기록",   환자번호: "P-2021-0204", 작성일자: "2021-11-04", 상태: "archived" },
    { 기록ID: "REC-2022-0411", 기록종류: "진단서부본", 환자번호: "P-2022-0411", 작성일자: "2022-12-01", 상태: "archived" },
    { 기록ID: "REC-2024-0512", 기록종류: "수술기록",   환자번호: "P-2024-0512", 작성일자: "2024-05-18", 상태: "active" },
    { 기록ID: "REC-2025-0789", 기록종류: "환자명부",   환자번호: "P-2025-0789", 작성일자: "2025-09-30", 상태: "active" },
    { 기록ID: "REC-2025-0790", 기록종류: "차트",       환자번호: "P-2025-0790", 작성일자: "2025-10-01", 상태: "active" },
    { 기록ID: "REC-2026-0011", 기록종류: "간호기록부", 환자번호: "P-2026-0011", 작성일자: "2026-02-14", 상태: "active" }
  ];

  $('[data-action="sample-ret"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleRetData, "샘플_의무기록_대장.xlsx", "샘플");
  });

  $('[data-action="run-ret"]').addEventListener("click", () => {
    const result = transform(sampleRetData);
    lastRows = result.rows.map(({_kind, ...rest}) => rest);
    render(result);
    persistRet(result);
    ActivityLog.push("retention", `보존 감사 시연 — ${result.rows.length}건`, { sample: true });
    const urgent = result.stats.over + result.stats.bad;
    setStatus($("#ret-status"), urgent > 0 ? "warn" : null,
      urgent > 0
        ? `샘플 9건 — ${urgent}건의 즉시 조치 항목이 있습니다 (만료 초과·분류 오류).`
        : "샘플 9건 모두 정상 보존 또는 모니터링 단계입니다.");
  });
}
