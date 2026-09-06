/* clinic-admin — Tab 05 · 의무기록 보존기간 점검 */
import { $, esc, todayISO, relTime, setStatus, bindDrop } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { Store, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";
import { Org, Batches, Patients } from "../core/entities.js";
import { orgHeaderPairs } from "./reporting-shared.js";

/* ─────────────────────────────────────────────────────────
   Tab 5 — 의무기록 보존기간 점검 (의료법 시행규칙 §15)
   · Rows carry the 환자번호 (optional column); the table shows Patients.alias(pid), never a name.
   · Every run is stored as a `retention` batch (id · type · pid · dates · verdict — counts only elsewhere) so the
     점검표 can be re-opened without re-uploading; retention.lastAudit keeps the dashboard counts.
   i18n: rows keep neutral fields, a verdict kind and [key, vars] note parts, so table, status and XLSX
   headers re-render from `lastResult` in either language. Record-type VALUES from the ledger stay as typed.
   ───────────────────────────────────────────────────────── */
let api = null;
export function seed() { api?.seed(); }

export function init(ctx) {
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
  const catByKey = (k) => DATA.retention.categories.find(c => c.key === k) || null;

  // Retention runs from the 진료완료일 (last treatment / record completion — 시행규칙 §15①,
  // confidence: high). 작성일자 is only a fallback and is flagged per row, because for a
  // long-running chart it under-states the true expiry.
  const DATE_COLS = ["진료완료일", "마지막진료일", "최종진료일"];
  const PID_COLS = ["환자번호", "등록번호"];
  const transform = (rows) => {
    const out = [];
    const stats = { ok: 0, soon: 0, over: 0, bad: 0, fallback: 0 };
    for (const row of rows) {
      const id = String(row["기록ID"] || row["ID"] || "");
      const pid = String(PID_COLS.map(c => row[c]).find(v => v != null && String(v).trim()) ?? "").trim();
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
        out.push({ id, pid, type: rawType, cat: null, basisDate, basis, years: "?", expiry: "—", remaining: "—", kind: "bad", notes: [["retention.noteFixType"]], fallback });
        continue;
      }

      const dt = new Date(basisDate);
      if (!basisDate || isNaN(dt.getTime())) {
        stats.bad++;
        out.push({ id, pid, type: cat.key, cat, basisDate, basis, years: cat.years, expiry: "—", remaining: "—", kind: "bad", notes: [["retention.noteFixDate"]], fallback });
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

      out.push({ id, pid, type: cat.key, cat, basisDate, basis, years: cat.years, expiry: expiry.toISOString().slice(0, 10), remaining: remainingDays, kind, notes, fallback });
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
          <th>${esc(t("retention.thId"))}</th><th class="code">${esc(t("retention.thPatient"))}</th><th>${esc(t("retention.thType2"))}</th><th class="code">${esc(t("retention.thBasisDate"))}</th>
          <th class="code">${esc(t("retention.thYearsShort"))}</th><th class="code">${esc(t("retention.thExpiry"))}</th>
          <th class="code">${esc(t("retention.thRemaining"))}</th><th>${esc(t("common.thResult"))}</th>
        </tr></thead>
        <tbody>
          ${sorted.map(r => {
            const cls = r.kind === "over" ? "err" : r.kind === "soon" ? "warn" : r.kind === "bad" ? "err" : "ok";
            const remaining = r.remaining === "—" ? "—" : (r.remaining < 0 ? "+" + (-r.remaining) : r.remaining);
            return `<tr>
              <td class="code">${esc(r.id)}</td>
              <td class="code">${esc(r.pid ? Patients.alias(r.pid) : "—")}</td>
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
  // Batch: the row-level result without the free-text ledger cells (type is the normalised category key).
  const storeBatch = (result, meta) => {
    const rows = result.rows.map(r => ({ id: r.id, pid: r.pid, type: r.type, basisDate: r.basisDate, basis: r.basis, years: r.years, expiry: r.expiry, remaining: r.remaining, kind: r.kind, notes: r.notes, fallback: r.fallback }));
    for (const r of result.rows) if (r.pid) Patients.touch(r.pid, /^\d{4}-\d{2}-\d{2}$/.test(r.basisDate) ? r.basisDate : undefined);
    return Batches.create({ kind: "retention", source: meta.fileName || "sample", rows, meta: { n: rows.length, ...result.stats, ...meta } });
  };
  const resultFromBatch = (b) => ({
    rows: (b.rows || []).map(r => ({ ...r, cat: catByKey(r.type), notes: r.notes || [] })),
    stats: { ok: b.meta?.ok ?? 0, soon: b.meta?.soon ?? 0, over: b.meta?.over ?? 0, bad: b.meta?.bad ?? 0, fallback: b.meta?.fallback ?? 0 }
  });
  const renderRecent = () => {
    const el = $("#ret-recent"); if (!el) return;
    const b = Batches.latest("retention");
    if (!b) { el.innerHTML = ""; el.style.display = "none"; return; }
    el.style.display = "flex";
    el.innerHTML = `<span class="dot"></span><span>${esc(t("retention.recent", { n: b.meta?.n ?? (b.rows || []).length, o: b.meta?.over ?? 0, when: relTime(b.createdAt) }))}</span>
      <button type="button" class="small-link" id="ret-recent-open">${esc(t("retention.recentOpen"))}</button>`;
    $("#ret-recent-open")?.addEventListener("click", () => {
      lastResult = resultFromBatch(b);
      render(lastResult);
      status(null, () => t("retention.statusFromBatch", { n: lastResult.rows.length, when: relTime(b.createdAt) }));
    });
  };
  renderRecent();
  Batches.onChange(renderRecent);

  const exportRows = (result) => result.rows.map(r => headerRow([
    ...orgHeaderPairs(Org.get()),
    ["retention.col.id", r.id], ["retention.col.pid", r.pid ? Patients.alias(r.pid) : ""], ["retention.col.type", typeText(r)], ["retention.col.basisDate", r.basisDate], ["retention.col.basis", basisText(r)],
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
      storeBatch(result, { fileName: file.name });
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

  // Old 2014–2016 records of the five shared demo patients. Two rows carry only 작성일자 (no 진료완료일) so
  // the per-row fallback warning is visible; "차트" is not a §15 category (classification error case).
  // Column headers are the Korean ledger names the checker expects (data, not UI copy).
  const sampleRetData = [
    { 기록ID: "REC-2014-0001", 기록종류: "진료기록부", 환자번호: "P-2026-0142", 작성일자: "2014-01-06", 진료완료일: "2014-03-14", 상태: "archived" },
    { 기록ID: "REC-2014-0002", 기록종류: "처방전",     환자번호: "P-2026-0142", 작성일자: "2014-03-14", 진료완료일: "2014-03-14", 상태: "archived" },
    { 기록ID: "REC-2015-0031", 기록종류: "방사선기록", 환자번호: "P-2026-0233", 작성일자: "2015-08-22", 진료완료일: "",           상태: "archived" },
    { 기록ID: "REC-2015-0044", 기록종류: "검사기록",   환자번호: "P-2026-0301", 작성일자: "2015-11-04", 진료완료일: "2015-11-04", 상태: "archived" },
    { 기록ID: "REC-2016-0007", 기록종류: "진단서부본", 환자번호: "P-2026-0418", 작성일자: "2016-01-12", 진료완료일: "2016-01-12", 상태: "archived" },
    { 기록ID: "REC-2016-0052", 기록종류: "진료기록부", 환자번호: "P-2026-0509", 작성일자: "2016-05-02", 진료완료일: "2016-10-20", 상태: "active" },
    { 기록ID: "REC-2016-0090", 기록종류: "환자명부",   환자번호: "P-2026-0301", 작성일자: "2016-09-30", 진료완료일: "",           상태: "active" },
    { 기록ID: "REC-2016-0101", 기록종류: "차트",       환자번호: "P-2026-0418", 작성일자: "2016-10-01", 진료완료일: "2016-10-01", 상태: "active" },
    { 기록ID: "REC-2016-0120", 기록종류: "수술기록",   환자번호: "P-2026-0509", 작성일자: "2016-12-01", 진료완료일: "2016-12-01", 상태: "active" }
  ];

  $('[data-action="sample-ret"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleRetData, t("retention.sampleFile"), t("common.sampleSheetShort"));
  });

  const runSample = () => {
    const result = transform(sampleRetData);
    lastResult = result;
    render(result);
    persistRet(result);
    storeBatch(result, { sample: true });
    ActivityLog.push("retention", t("retention.logSample", { n: result.rows.length }), { sample: true });
    const urgent = result.stats.over + result.stats.bad;
    status(urgent > 0 ? "warn" : null, () => urgent > 0
      ? t("retention.statusSampleUrgent", { n: result.rows.length, u: urgent, f: result.stats.fallback })
      : t("retention.statusSampleOk", { n: result.rows.length }));
  };
  $('[data-action="run-ret"]').addEventListener("click", runSample);

  onLangChange(() => {
    renderLegal(); renderRecent();
    if (lastResult) render(lastResult);
    if (lastStatus) setStatus($("#ret-status"), lastStatus.kind, lastStatus.fn());
  });

  api = { seed: runSample };
}
