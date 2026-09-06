/* clinic-admin — Tab 05 · 의무기록 보존기간 점검 */
import { $, esc, todayISO, relTime, setStatus, bindDrop, Toast } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow, pocMark } from "../core/files.js";
import { Session } from "../security/session.js";
import { Org, Staff, Batches, Patients } from "../core/entities.js";
import { orgHeaderPairs, pseudoId } from "./reporting-shared.js";
import { registerRows } from "../security/lifecycle.js";

/* ─────────────────────────────────────────────────────────
   Tab 5 — 의무기록 보존기간 점검 (의료법 시행규칙 §15)
   · Rows carry the 환자번호 (optional column); the table shows Patients.alias(pid), never a name.
   · Every run is stored as a `retention` batch (id · type · pid · dates · verdict — counts only elsewhere) so the
     점검표 can be re-opened without re-uploading; retention.lastAudit keeps the dashboard counts.
   i18n: rows keep neutral fields, a verdict kind and [key, vars] note parts, so table, status and XLSX
   headers re-render from `lastResult` in either language. Record-type VALUES from the ledger stay as typed.
   · 파기 대장 (Phase 3): the 초과 rows of the current result become the 파기 대상 목록; "파기 대장 생성" writes one
     disposal per row to `retention.disposals` (encrypted — it carries the staff name snapshot and the pid) and downloads
     the ledger as XLSX (기록ID pseudonymised, 종류, 보존기한, 파기일, 담당자, 방법, 승인자; PoC watermark). The 폐기 심의
     itself is an internal procedure, not a statutory duty — the ledger is its evidence (인증 mr3 reads retentionStats()).
   ───────────────────────────────────────────────────────── */
let api = null;
export function seed() { api?.seed(); }

const DISPOSALS_KEY = "retention.disposals";
const METHODS = ["shred", "erase"]; // 파쇄 · 전자삭제 — labels via retention.method.*
registerRows([{
  key: DISPOSALS_KEY, label: "의무기록 파기 대장", detail: "기록ID(가명)·환자번호·종류·보존기한·파기일·방법·담당자/승인자 이름 스냅샷",
  purpose: "보존기간 경과 기록의 파기 근거 (내부 폐기 심의 · 인증 자체점검 mr3)", basis: "의료법 시행규칙 §15 보존기간 · 개인정보보호법 §21 파기 (PoC: 5년 보존, 확인 필요)",
  encrypted: true, retention: "5년 (확인 필요)", days: 5 * 365 + 1,
  purge: (v, cutoff) => (Array.isArray(v) ? v.filter(d => (d.at || 0) >= cutoff) : v)
}]);
const readDisposals = () => { const v = Store.get(DISPOSALS_KEY, []); return Array.isArray(v) ? v : []; };
/* retentionStats() — for 인증 자체점검 (tab9-accred.js mr3 reads `disposals` as the disposal-review evidence) and 홈:
   { disposals, lastDisposalAt, lastAudit }. */
export function retentionStats() {
  const rows = readDisposals();
  return { disposals: rows.length, lastDisposalAt: rows.reduce((m, r) => Math.max(m, r.at || 0), 0) || null, lastAudit: Store.get("retention.lastAudit") || null };
}

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
    renderDisposal(result);
  };

  // ── 파기 대장 — the 초과 rows of the current result ──
  const methodLabel = (m) => t("retention.method." + m);
  const disposalTargets = (result) => (result?.rows || []).filter(r => r.kind === "over");
  const doneKey = (batchId, recId) => `${batchId || ""}|${recId}`;
  let disposalMethod = "shred", approverId = "";
  const renderDisposal = (result) => {
    const box = $("#ret-dispose"); if (!box) return;
    const targets = disposalTargets(result);
    const done = readDisposals();
    const doneIds = new Set(done.map(d => doneKey(d.batchId, d.recId)));
    const approvers = Staff.list().filter(s => s.job === "한의사" || s.job === "행정");
    if (!approverId && approvers.length) approverId = (approvers.find(s => Staff.loginOf(s)?.role === "원장") || approvers[0]).id;
    const batchId = Batches.latest("retention")?.id || "";
    const pending = targets.filter(r => !doneIds.has(doneKey(batchId, pseudoId(r.id))));
    $("#ret-dispose-count").textContent = String(targets.length);
    $("#ret-dispose-btn").disabled = pending.length === 0;
    $("#ret-dispose-summary").innerHTML = targets.length
      ? t("retention.dispose.summary", { n: targets.length, p: pending.length, d: done.length })
      : t("retention.dispose.empty");
    if (!targets.length) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="ret-dispose-form">
        <div class="ret-dispose-field"><label for="ret-dispose-method">${esc(t("retention.dispose.method"))}</label>
          <select id="ret-dispose-method">${METHODS.map(m => `<option value="${m}" ${m === disposalMethod ? "selected" : ""}>${esc(methodLabel(m))}</option>`).join("")}</select></div>
        <div class="ret-dispose-field"><label for="ret-dispose-approver">${esc(t("retention.dispose.approver"))}</label>
          <select id="ret-dispose-approver">${approvers.length ? approvers.map(s => `<option value="${esc(s.id)}" ${s.id === approverId ? "selected" : ""}>${esc(Staff.ref(s))}</option>`).join("") : `<option value="">${esc(t("retention.dispose.noApprover"))}</option>`}</select></div>
        <span class="ret-dispose-officer">${esc(t("retention.dispose.officer"))} <strong>${esc(Session.user()?.name || "—")}</strong></span>
      </div>
      <table class="ret-dispose-table">
        <thead><tr><th class="code">${esc(t("retention.dispose.thRec"))}</th><th class="code">${esc(t("retention.thPatient"))}</th><th>${esc(t("retention.thType2"))}</th><th class="code">${esc(t("retention.thExpiry"))}</th><th>${esc(t("common.thResult"))}</th></tr></thead>
        <tbody>${targets.map(r => { const dn = doneIds.has(doneKey(batchId, pseudoId(r.id))); return `<tr class="${dn ? "disposed" : ""}"><td class="code">${esc(pseudoId(r.id))}</td><td class="code">${esc(r.pid ? Patients.alias(r.pid) : "—")}</td><td>${esc(typeText(r))}</td><td class="code">${esc(r.expiry)}</td><td><span class="pill ${dn ? "ok" : "err"}">${esc(dn ? t("retention.dispose.done") : t("retention.dispose.pending"))}</span></td></tr>`; }).join("")}</tbody>
      </table>`;
    $("#ret-dispose-method")?.addEventListener("change", (e) => { disposalMethod = e.target.value; });
    $("#ret-dispose-approver")?.addEventListener("change", (e) => { approverId = e.target.value; });
  };
  const renderLedger = () => {
    const el = $("#ret-ledger"); if (!el) return;
    const rows = readDisposals();
    $("#ret-ledger-count").textContent = String(rows.length);
    $("#ret-ledger-download").disabled = rows.length === 0;
    if (!rows.length) { el.innerHTML = `<div class="empty-state">${esc(t("retention.ledger.empty"))}</div>`; return; }
    const recent = [...rows].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 30);
    el.innerHTML = `<table>
      <thead><tr><th class="code">${esc(t("retention.ledger.thDate"))}</th><th class="code">${esc(t("retention.dispose.thRec"))}</th><th>${esc(t("retention.thType2"))}</th><th class="code">${esc(t("retention.thExpiry"))}</th><th>${esc(t("retention.dispose.method"))}</th><th>${esc(t("retention.dispose.officer"))}</th><th>${esc(t("retention.dispose.approver"))}</th></tr></thead>
      <tbody>${recent.map(d => `<tr><td class="code">${esc(d.disposedOn)}</td><td class="code">${esc(d.recId)}</td><td>${esc(d.type)}</td><td class="code">${esc(d.expiry)}</td><td>${esc(methodLabel(d.method))}</td><td>${esc(d.staffName || "—")}</td><td>${esc(d.approverName || "—")}</td></tr>`).join("")}</tbody>
    </table>${rows.length > recent.length ? `<p class="caveat">${esc(t("retention.ledger.more", { n: rows.length - recent.length }))}</p>` : ""}`;
  };
  const ledgerRows = (rows) => rows.map(d => headerRow([
    ...orgHeaderPairs(Org.get()),
    ["retention.ledger.col.rec", d.recId], ["retention.ledger.col.pid", d.pid ? Patients.alias(d.pid) : ""], ["retention.ledger.col.type", d.type], ["retention.ledger.col.expiry", d.expiry],
    ["retention.ledger.col.disposedOn", d.disposedOn], ["retention.ledger.col.officer", d.staffName || ""], ["retention.ledger.col.method", methodLabel(d.method)], ["retention.ledger.col.approver", d.approverName || ""],
    ["retention.ledger.col.note", pocMark()]
  ]));
  $("#ret-dispose-btn")?.addEventListener("click", () => {
    if (!lastResult) return;
    if (!Session.isUnlocked()) { Toast.show({ tag: "system", html: esc(t("retention.dispose.locked")) }); return; }
    const u = Session.user();
    const batchId = Batches.latest("retention")?.id || "";
    const existing = readDisposals();
    const doneIds = new Set(existing.map(d => doneKey(d.batchId, d.recId)));
    const today = todayISO();
    const approver = approverId ? Staff.get(approverId) : null;
    const fresh = disposalTargets(lastResult).filter(r => !doneIds.has(doneKey(batchId, pseudoId(r.id)))).map(r => ({
      id: `dp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), batchId,
      recId: pseudoId(r.id), pid: r.pid || "", type: typeText(r), typeKey: r.type, expiry: r.expiry, disposedOn: today,
      method: disposalMethod, staffId: u?.staffId || null, staffName: u?.name || "", approverId: approver?.id || null, approverName: approver?.name || ""
    }));
    if (!fresh.length) return;
    Store.set(DISPOSALS_KEY, [...existing, ...fresh]);
    downloadXLSX(ledgerRows(fresh), t("retention.ledger.file", { date: today }), t("retention.ledger.sheet")); // watermark + _PoC applied inside
    ActivityLog.push("retention", t("retention.dispose.log", { n: fresh.length, m: methodLabel(disposalMethod) }), {});
    status(null, () => t("retention.dispose.status", { n: fresh.length }));
    renderDisposal(lastResult); renderLedger();
  });
  $("#ret-ledger-download")?.addEventListener("click", () => {
    const rows = readDisposals(); if (!rows.length) return;
    downloadXLSX(ledgerRows(rows), t("retention.ledger.file", { date: todayISO() }), t("retention.ledger.sheet"));
    ActivityLog.push("retention", t("retention.ledger.log", { n: rows.length }), {});
  });
  renderLedger();
  EventBus.on(`store:${DISPOSALS_KEY}`, () => { renderLedger(); if (lastResult) renderDisposal(lastResult); });
  EventBus.on("session:unlocked", () => { renderLedger(); if (lastResult) renderDisposal(lastResult); });
  Staff.onChange(() => { if (lastResult) renderDisposal(lastResult); });

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
    renderLegal(); renderRecent(); renderLedger();
    if (lastResult) render(lastResult);
    if (lastStatus) setStatus($("#ret-status"), lastStatus.kind, lastStatus.fn());
  });

  api = { seed: runSample };
}
