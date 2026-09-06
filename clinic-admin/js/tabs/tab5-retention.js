/* clinic-admin — Tab 05 · 의무기록 보존기간 점검 */
import { $, esc, todayISO, setStatus, bindDrop } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { Store, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   Tab 5 — 의무기록 보존기간 점검 (의료법 시행규칙 §15)
   i18n: rows keep neutral fields, a verdict kind and [key, vars] note parts, so table, status and XLSX
   headers re-render from `lastResult` in either language. Record-type VALUES from the ledger stay as typed.
   ───────────────────────────────────────────────────────── */
export function initTab5(ctx) {
  const { DATA } = ctx;
  const catName = (c) => pick(c, "name") || c.key;
  // render legal table
  const renderLegal = () => {
    $("#ret-table").innerHTML = DATA.retention.categories.map(c =>
      `<tr><td>${esc(catName(c))}</td><td class="code">${esc(t("retention.years", { n: c.years }))}</td><td class="code" style="color:var(--muted)">${esc(t("retention.basisCell"))}</td></tr>`
    ).join("");
  };
  renderLegal();

  let lastResult = null, lastStatus = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#ret-status"), kind, fn()); };
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

  // Retention runs from the 진료완료일 (last treatment / record completion — 시행규칙 §15①,
  // confidence: high). 작성일자 is only a fallback and is flagged per row, because for a
  // long-running chart it under-states the true expiry.
  const DATE_COLS = ["진료완료일", "마지막진료일", "최종진료일"];
  const transform = (rows) => {
    const out = [];
    const stats = { ok: 0, soon: 0, over: 0, bad: 0, fallback: 0 };
    for (const row of rows) {
      const id = String(row["기록ID"] || row["ID"] || "");
      const rawType = String(row["기록종류"] || row["종류"] || "");
      const basisCol = DATE_COLS.find(c => String(row[c] ?? "").trim()) || (String(row["작성일자"] ?? "").trim() ? "작성일자" : "");
      const basisDate = basisCol ? String(row[basisCol]).trim() : "";
      const fallback = basisCol === "작성일자";
      if (fallback) stats.fallback++;
      // basis: [key] for the two special cases, else the ledger's own column name (file data)
      const basis = fallback ? ["retention.basisFallback"] : basisCol ? basisCol : ["retention.basisNone"];
      const cat = normalize(rawType);

      if (!cat) {
        stats.bad++;
        out.push({ id, type: rawType, cat: null, basisDate, basis, years: "?", expiry: "—", remaining: "—", kind: "bad", notes: [["retention.noteFixType"]], fallback });
        continue;
      }

      const dt = new Date(basisDate);
      if (!basisDate || isNaN(dt.getTime())) {
        stats.bad++;
        out.push({ id, type: cat.key, cat, basisDate, basis, years: cat.years, expiry: "—", remaining: "—", kind: "bad", notes: [["retention.noteFixDate"]], fallback });
        continue;
      }

      const expiry = new Date(dt);
      expiry.setFullYear(expiry.getFullYear() + cat.years);
      const remainingDays = Math.round((expiry - today) / 86400000);

      let kind, notes = [];
      if (remainingDays < 0) { kind = "over"; notes.push(["retention.noteOver", { n: -remainingDays }]); stats.over++; }
      else if (remainingDays <= 180) { kind = "soon"; notes.push(["retention.noteSoon", { n: remainingDays }]); stats.soon++; }
      else { kind = "ok"; stats.ok++; }
      if (fallback) notes.push(["retention.noteRecalc"]);

      out.push({ id, type: cat.key, cat, basisDate, basis, years: cat.years, expiry: expiry.toISOString().slice(0, 10), remaining: remainingDays, kind, notes, fallback });
    }
    return { rows: out, stats };
  };
  const verdictText = (k) => t("retention.v." + k);
  const notesText = (r) => r.notes.length ? r.notes.map(([k, v]) => t(k, v)).join(" · ") : "—";
  const basisText = (r) => Array.isArray(r.basis) ? t(r.basis[0]) : r.basis;
  const typeText = (r) => r.cat ? catName(r.cat) : r.type;

  const render = (result) => {
    const { rows, stats } = result;
    $("#ret-stats").style.display = "grid";
    $("#ret-ok").textContent = stats.ok;
    $("#ret-soon").textContent = stats.soon;
    $("#ret-over").textContent = stats.over;
    $("#ret-bad").textContent = stats.bad;
    $("#ret-toolbar").style.display = "flex";
    $("#ret-summary").innerHTML = t("retention.summary", { n: rows.length, u: stats.over + stats.bad }) + (stats.fallback ? t("retention.summaryFallback", { n: stats.fallback }) : "");
    $("#ret-download").disabled = false;

    // Sort: over → soon → bad → ok
    const sorted = [...rows].sort((a, b) => {
      const order = { over: 0, soon: 1, bad: 2, ok: 3 };
      return (order[a.kind] ?? 3) - (order[b.kind] ?? 3);
    });

    $("#ret-result").innerHTML = `
      <table>
        <thead><tr>
          <th>${esc(t("retention.thId"))}</th><th>${esc(t("retention.thType2"))}</th><th class="code">${esc(t("retention.thBasisDate"))}</th>
          <th class="code">${esc(t("retention.thYearsShort"))}</th><th class="code">${esc(t("retention.thExpiry"))}</th>
          <th class="code">${esc(t("retention.thRemaining"))}</th><th>${esc(t("common.thResult"))}</th>
        </tr></thead>
        <tbody>
          ${sorted.map(r => {
            const cls = r.kind === "over" ? "err" : r.kind === "soon" ? "warn" : r.kind === "bad" ? "err" : "ok";
            const remaining = r.remaining === "—" ? "—" : (r.remaining < 0 ? "+" + (-r.remaining) : r.remaining);
            return `<tr>
              <td class="code">${esc(r.id)}</td>
              <td>${esc(typeText(r))}</td>
              <td class="code">${esc(r.basisDate)}${r.fallback ? `<span class="basis-warn" title="${esc(t("retention.basisFallback"))}">${esc(t("retention.basisWarn"))}</span>` : ""}</td>
              <td class="code">${esc(r.years)}</td>
              <td class="code">${esc(r.expiry)}</td>
              <td class="code" style="text-align:right">${esc(remaining)}</td>
              <td><span class="pill ${cls}">${esc(verdictText(r.kind))}</span></td>
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

  const exportRows = (result) => result.rows.map(r => headerRow([
    ["retention.col.id", r.id], ["retention.col.type", typeText(r)], ["retention.col.basisDate", r.basisDate], ["retention.col.basis", basisText(r)],
    ["retention.col.years", r.years], ["retention.col.expiry", r.expiry], ["retention.col.remaining", r.remaining],
    ["retention.col.verdict", verdictText(r.kind)], ["retention.col.action", notesText(r)]
  ]));

  bindDrop("drop-ret", async (file) => {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) {
        status("warn", () => t("common.statusEmptyFileShort"));
        return;
      }
      const result = transform(rows);
      lastResult = result;
      render(result);
      persistRet(result);
      ActivityLog.push("retention", t("retention.logRun", { n: result.rows.length, o: result.stats.over, s: result.stats.soon }), { file: file.name });
      const urgent = result.stats.over + result.stats.bad;
      if (urgent > 0) {
        status("warn", () => t("retention.statusUrgent", { u: urgent }) + (result.stats.fallback ? t("retention.statusFallbackNote", { n: result.stats.fallback }) : ""));
      } else {
        status(null, () => t("retention.statusAllOk", { n: result.rows.length }));
      }
    } catch (err) {
      status("err", () => t("common.statusReadFailShort"));
    }
  });

  $("#ret-download").addEventListener("click", () => {
    if (!lastResult) return;
    const rows = exportRows(lastResult);
    downloadXLSX(rows, t("retention.file", { date: todayISO() }), t("retention.sheet")); // watermark + _PoC applied inside
    ActivityLog.push("retention", t("retention.logDl", { n: rows.length }), {});
  });

  // Two rows carry only 작성일자 (no 진료완료일) so the per-row fallback warning is visible.
  // Column headers are the Korean ledger names the checker expects (data, not UI copy).
  const sampleRetData = [
    { 기록ID: "REC-2014-0001", 기록종류: "진료기록부", 환자번호: "P-2014-0042", 작성일자: "2014-01-06", 진료완료일: "2014-03-14", 상태: "active" },
    { 기록ID: "REC-2014-0002", 기록종류: "처방전",     환자번호: "P-2014-0042", 작성일자: "2014-03-14", 진료완료일: "2014-03-14", 상태: "active" },
    { 기록ID: "REC-2020-0098", 기록종류: "방사선기록", 환자번호: "P-2020-0098", 작성일자: "2020-08-22", 진료완료일: "",           상태: "archived" },
    { 기록ID: "REC-2021-0204", 기록종류: "검사기록",   환자번호: "P-2021-0204", 작성일자: "2021-11-04", 진료완료일: "2021-11-04", 상태: "archived" },
    { 기록ID: "REC-2022-0411", 기록종류: "진단서부본", 환자번호: "P-2022-0411", 작성일자: "2022-12-01", 진료완료일: "2022-12-01", 상태: "archived" },
    { 기록ID: "REC-2024-0512", 기록종류: "수술기록",   환자번호: "P-2024-0512", 작성일자: "2024-05-18", 진료완료일: "2024-05-18", 상태: "active" },
    { 기록ID: "REC-2025-0789", 기록종류: "환자명부",   환자번호: "P-2025-0789", 작성일자: "2025-09-30", 진료완료일: "",           상태: "active" },
    { 기록ID: "REC-2025-0790", 기록종류: "차트",       환자번호: "P-2025-0790", 작성일자: "2025-10-01", 진료완료일: "2025-10-01", 상태: "active" },
    { 기록ID: "REC-2026-0011", 기록종류: "간호기록부", 환자번호: "P-2026-0011", 작성일자: "2026-02-14", 진료완료일: "2026-02-14", 상태: "active" }
  ];

  $('[data-action="sample-ret"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleRetData, t("retention.sampleFile"), t("common.sampleSheetShort"));
  });

  $('[data-action="run-ret"]').addEventListener("click", () => {
    const result = transform(sampleRetData);
    lastResult = result;
    render(result);
    persistRet(result);
    ActivityLog.push("retention", t("retention.logSample", { n: result.rows.length }), { sample: true });
    const urgent = result.stats.over + result.stats.bad;
    status(urgent > 0 ? "warn" : null, () => urgent > 0
      ? t("retention.statusSampleUrgent", { n: result.rows.length, u: urgent, f: result.stats.fallback })
      : t("retention.statusSampleOk", { n: result.rows.length }));
  });

  onLangChange(() => {
    renderLegal();
    if (lastResult) render(lastResult);
    if (lastStatus) setStatus($("#ret-status"), lastStatus.kind, lastStatus.fn());
  });
}
