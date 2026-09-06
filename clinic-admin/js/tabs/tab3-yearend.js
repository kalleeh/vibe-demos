/* clinic-admin — Tab 03 · 연말정산 의료비 자료 사전점검 */
import { $, esc, fmtKRW, won, todayISO, relTime, setStatus, bindDrop, Toast } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, downloadCSV, headerRow } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Org, Batches, Patients } from "../core/entities.js";
import { checkRRN, maskRRN, renderOrgReadOnly, orgHeaderPairs } from "./reporting-shared.js";

/* ─────────────────────────────────────────────────────────
   Tab 3 — 연말정산 의료비 자료 사전점검
   Validates an EMR export row by row BEFORE the hospital submits 간소화 자료 (홈택스 or the EMR's
   국세청 module). Nothing here is a submission format; the output is a 사전점검 정리표.
   · 주민등록번호 is parsed in memory only — never persisted, always masked.
   · Institution fields come from Org (read-only here; edited in the shell's info modal).
   · The run is stored as a `yearend` batch WITHOUT names or RRNs (pid · date · amounts · verdict) so the
     정리표 and the claims cross-check can be re-opened without re-uploading.
   · Cross-check: when a `claims` batch exists, pid+date pairs in the tax year are compared both ways.
   · 환자 문의 대응 (Phase 3): January's "영수증 빠졌어요" call — type a 환자번호, see whether it is in the latest yearend
     batch (visits · 합계 · errors, alias only) and hand the case to the 발급 대장:
     activateTab("tab-docs", { pid, create: true, docType: "영수증 재발급" }). While that panel is not mounted the button
     explains so (toast) — the ctx it would send is on the button's data-ctx.
   i18n: rows keep neutral fields + [key, vars] issue messages so tables, status and CSV headers re-render. */
let api = null;
export function seed() { api?.seed(); }

export function init() {
  let lastResult = null, lastStatus = null, fromBatch = false;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#ye-status"), kind, fn()); };
  const taxYear = () => +$("#ye-year").value || new Date().getFullYear() - 1;

  const pick = (row, keys) => { for (const k of keys) if (row[k] != null && row[k] !== "") return row[k]; return ""; };
  const PID_COLS = ["환자번호", "등록번호"];
  const DATE_COLS = ["진료일자", "진료일", "일자"];
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
  const fieldText = (f) => t("yearend.f." + f);
  const msgText = (m) => Array.isArray(m) ? t(m[0], m[1]) : String(m ?? "");
  const verdictText = (lvl) => t("yearend.v." + lvl);
  const worstOf = (issues) => issues.some(i => i.level === "error") ? "error" : issues.some(i => i.level === "warn") ? "warn" : "ok";

  // ── institution (read-only) ──
  const renderOrg = () => renderOrgReadOnly($("#ye-org"), Org.get(), { onEdit: () => activateTab("tab-org") }); // 조직 › 기관 프로필
  renderOrg();
  Org.onChange(renderOrg);

  // Returns { rows, issues, patients, taxYear, hasPid }.
  const validate = (rows) => {
    const y = taxYear();
    const out = [], issues = [], seen = new Map(), patients = new Map();
    let hasPid = false;
    rows.forEach((row, idx) => {
      const n = idx + 2; // spreadsheet row number (header = 1)
      const name = String(pick(row, ["환자성명", "성명", "환자명"])).trim();
      const pid = String(pick(row, PID_COLS)).trim();
      if (pid) hasPid = true;
      const rrnRaw = pick(row, ["주민등록번호", "주민번호"]);
      const rrn = checkRRN(rrnRaw);
      const masked = maskRRN(rrnRaw);
      const date = parseDate(pick(row, DATE_COLS));
      const own = parseAmount(pick(row, ["본인부담금", "본인부담"]));
      const non = parseAmount(pick(row, ["비급여금액", "비급여"]));
      const tot = parseAmount(pick(row, ["의료비총액", "총진료비", "총액"]));
      const rowIssues = [];
      const add = (level, field, msg) => { rowIssues.push({ level, field, msg }); issues.push({ row: n, name, pid, masked, level, field, msg }); };

      if (rrn.level !== "ok") add(rrn.level, "rrn", rrn.msgKey ? [rrn.msgKey, rrn.vars] : rrn.msg);
      if (!date) add("error", "date", ["yearend.msgDateFormat"]);
      else if (+date.slice(0, 4) !== y) add("error", "date", ["yearend.msgOutOfYear", { y }]);
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

      const worst = worstOf(rowIssues);
      out.push({ row: n, name, pid, masked, date: date || String(pick(row, DATE_COLS)), total: totalV, own: ownV, non: nonV, verdict: worst, issues: rowIssues });

      // Per-patient totals — keyed by 환자번호 when present, else RRN digits, else name.
      const pk = pid ? `pid:${pid}` : rrn.digits.length === 13 ? rrn.digits : `name:${name}`;
      const p = patients.get(pk) || { name, pid, masked, count: 0, total: 0, own: 0, non: 0, errors: 0 };
      p.count++; p.total += totalV; p.own += ownV; p.non += nonV;
      if (worst === "error") p.errors++;
      patients.set(pk, p);
    });
    return { rows: out, issues, patients: [...patients.values()], taxYear: y, hasPid };
  };
  const rowNotes = (r) => r.issues.map(i => `${fieldText(i.field)}: ${msgText(i.msg)}`).join(" / ");

  // ── claims cross-check (pid ⨝ date, tax year only) ──
  const xcheck = (result) => {
    const claims = Batches.latest("claims");
    if (!claims) return null;
    if (!result.hasPid) return { claims, noPid: true };
    const y = String(result.taxYear);
    const key = (pid, date) => `${String(pid).trim()}|${date}`;
    const fileKeys = new Map();
    for (const r of result.rows) if (r.pid && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date.startsWith(y)) fileKeys.set(key(r.pid, r.date), r);
    const claimKeys = new Map();
    for (const c of claims.rows || []) {
      const d = parseDate(c.date); const pid = String(c.pid ?? "").trim();
      if (!pid || !d || !d.startsWith(y)) continue;
      const k = key(pid, d);
      if (!claimKeys.has(k)) claimKeys.set(k, { pid, date: d, stmts: new Set() });
      if (c.stmt) claimKeys.get(k).stmts.add(String(c.stmt));
    }
    const onlyClaims = [...claimKeys.values()].filter(c => !fileKeys.has(key(c.pid, c.date)));
    const onlyFile = [...fileKeys.values()].filter(r => !claimKeys.has(key(r.pid, r.date)));
    return { claims, onlyClaims, onlyFile, matched: [...fileKeys.keys()].filter(k => claimKeys.has(k)).length, claimVisits: claimKeys.size };
  };
  const renderXCheck = (result) => {
    const x = xcheck(result);
    if (!x) return "";
    if (x.noPid) return `<div class="xcheck"><h5 class="ye-subhead">${esc(t("yearend.xc.h"))}</h5><div class="status-line warn" style="display:flex"><span class="dot"></span><span>${esc(t("yearend.xc.noPid"))}</span></div></div>`;
    const list = (rows, fmt) => rows.length ? `<ul class="xcheck-list">${rows.slice(0, 12).map(fmt).join("")}${rows.length > 12 ? `<li class="more">${esc(t("yearend.xc.more", { n: rows.length - 12 }))}</li>` : ""}</ul>` : `<div class="xcheck-none">${esc(t("yearend.xc.none"))}</div>`;
    return `
      <div class="xcheck" id="ye-xcheck">
        <h5 class="ye-subhead">${esc(t("yearend.xc.h"))}</h5>
        <p class="xcheck-meta">${esc(t("yearend.xc.meta", { y: result.taxYear, n: x.claimVisits, m: x.matched, when: relTime(x.claims.createdAt) }))}</p>
        <div class="xcheck-cols">
          <div class="xcheck-col ${x.onlyClaims.length ? "warn" : ""}">
            <h6>${esc(t("yearend.xc.onlyClaims"))} <strong>${x.onlyClaims.length}</strong></h6>
            ${list(x.onlyClaims, c => `<li><span class="code">${esc(Patients.alias(c.pid))}</span> · <span class="code">${esc(c.date)}</span>${c.stmts.size ? ` · ${esc(t("yearend.xc.stmt", { s: [...c.stmts].join(", ") }))}` : ""}</li>`)}
          </div>
          <div class="xcheck-col ${x.onlyFile.length ? "warn" : ""}">
            <h6>${esc(t("yearend.xc.onlyFile"))} <strong>${x.onlyFile.length}</strong></h6>
            ${list(x.onlyFile, r => `<li><span class="code">${esc(Patients.alias(r.pid))}</span> · <span class="code">${esc(r.date)}</span> · ${esc(won(r.total))}</li>`)}
          </div>
        </div>
        <p class="caveat" style="margin-top:8px">${esc(t("yearend.xc.caveat"))}</p>
      </div>`;
  };

  const render = (result) => {
    const { rows, issues, patients, taxYear: y } = result;
    const total = rows.reduce((s, r) => s + (r.total || 0), 0);
    const errs = issues.filter(i => i.level === "error").length;
    const warns = issues.filter(i => i.level === "warn").length;
    $("#ye-summary").innerHTML = t("yearend.summary", { n: rows.length, total: won(total), e: errs, w: warns, y });
    $("#ye-toolbar").style.display = "flex";
    $("#ye-download").disabled = false;
    // From a stored batch: names/RRNs were never kept → alias + "—".
    const who = (r) => fromBatch ? Patients.alias(r.pid) : (r.name || (r.pid ? Patients.alias(r.pid) : ""));
    const rrnCell = (r) => fromBatch ? "—" : r.masked;

    const pill = (lvl) => lvl === "error" ? `<span class="pill err">${esc(verdictText("error"))}</span>` : `<span class="pill warn">${esc(verdictText("warn"))}</span>`;
    const issueTable = issues.length ? `
      <h5 class="ye-subhead">${esc(t("yearend.issuesH", { e: errs, w: warns }))}</h5>
      <table class="ye-issues">
        <thead><tr><th class="code">${esc(t("yearend.thRow"))}</th><th>${esc(t("yearend.thPatient"))}</th><th class="code">${esc(t("yearend.thPid"))}</th><th class="code">${esc(t("yearend.thRrn"))}</th><th>${esc(t("yearend.thField"))}</th><th>${esc(t("yearend.thDetail"))}</th><th>${esc(t("yearend.thLevel"))}</th></tr></thead>
        <tbody>${issues.map(i => `<tr class="${i.level === "error" ? "row-err" : "row-warn"}">
          <td class="code">${i.row}</td><td>${esc(who(i))}</td><td class="code">${esc(i.pid || "—")}</td><td class="code">${esc(rrnCell(i))}</td>
          <td>${esc(fieldText(i.field))}</td><td>${esc(msgText(i.msg))}</td><td>${pill(i.level)}</td></tr>`).join("")}
        </tbody>
      </table>` : `<div class="status-line" style="display:flex"><span class="dot"></span><span>${esc(t("yearend.noIssues"))}</span></div>`;

    const patientTable = `
      <h5 class="ye-subhead">${esc(t("yearend.patientsH", { n: patients.length }))}</h5>
      <table>
        <thead><tr><th>${esc(t("yearend.thPatient"))}</th><th class="code">${esc(t("yearend.thPid"))}</th><th class="code">${esc(t("yearend.thRrn"))}</th><th class="code">${esc(t("yearend.thCount"))}</th><th class="code">${esc(t("yearend.thOwn"))}</th><th class="code">${esc(t("yearend.thNon"))}</th><th class="code">${esc(t("yearend.thSum"))}</th></tr></thead>
        <tbody>${patients.map(p => `<tr>
          <td>${esc(who(p))}${p.errors ? ` <span class="pill err">${esc(t("yearend.errBadge", { n: p.errors }))}</span>` : ""}</td>
          <td class="code">${esc(p.pid || "—")}</td>
          <td class="code">${esc(rrnCell(p))}</td>
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
          <th class="code">${esc(t("yearend.thRow"))}</th><th>${esc(t("yearend.thName"))}</th><th class="code">${esc(t("yearend.thPid"))}</th><th class="code">${esc(t("yearend.thRrn"))}</th><th class="code">${esc(t("jabo.fDate"))}</th>
          <th class="code">${esc(t("yearend.thTotal"))}</th><th class="code">${esc(t("yearend.thOwn"))}</th><th class="code">${esc(t("yearend.thNon"))}</th><th>${esc(t("yearend.thCheck"))}</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td class="code">${r.row}</td>
            <td>${esc(who(r))}</td>
            <td class="code">${esc(r.pid || "—")}</td>
            <td class="code">${esc(rrnCell(r))}</td>
            <td class="code">${esc(r.date)}</td>
            <td class="code" style="text-align:right">${fmtKRW(r.total)}</td>
            <td class="code" style="text-align:right">${fmtKRW(r.own)}</td>
            <td class="code" style="text-align:right">${fmtKRW(r.non)}</td>
            <td><span class="pill ${r.verdict === "error" ? "err" : r.verdict === "warn" ? "warn" : "ok"}">${esc(verdictText(r.verdict))}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    $("#ye-result").innerHTML = renderXCheck(result) + issueTable + patientTable + rowTable;
  };

  // ── batch: store the run without names / RRNs ──
  const storeBatch = (result, meta) => {
    const rows = result.rows.map(r => ({ row: r.row, pid: r.pid, date: r.date, own: r.own, non: r.non, total: r.total, verdict: r.verdict, issues: r.issues.map(i => ({ level: i.level, field: i.field, msg: i.msg })) }));
    const errs = result.issues.filter(i => i.level === "error").length, warns = result.issues.length - errs;
    for (const r of result.rows) if (r.pid) Patients.touch(r.pid, /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : undefined);
    return Batches.create({ kind: "yearend", source: meta.fileName || "sample", rows, meta: { taxYear: result.taxYear, n: rows.length, errors: errs, warns, hasPid: result.hasPid, ...meta } });
  };
  // Rebuild a render-able result from a stored batch (no names/RRNs — aliases + "—").
  const resultFromBatch = (b) => {
    const rows = (b.rows || []).map(r => ({ ...r, name: "", masked: "—", issues: r.issues || [] }));
    const issues = [];
    const patients = new Map();
    for (const r of rows) {
      for (const i of r.issues) issues.push({ row: r.row, name: "", pid: r.pid, masked: "—", level: i.level, field: i.field, msg: i.msg });
      const pk = r.pid ? `pid:${r.pid}` : `row:${r.row}`;
      const p = patients.get(pk) || { name: "", pid: r.pid, masked: "—", count: 0, total: 0, own: 0, non: 0, errors: 0 };
      p.count++; p.total += r.total || 0; p.own += r.own || 0; p.non += r.non || 0;
      if (r.verdict === "error") p.errors++;
      patients.set(pk, p);
    }
    return { rows, issues, patients: [...patients.values()], taxYear: b.meta?.taxYear || taxYear(), hasPid: !!b.meta?.hasPid };
  };
  const renderRecent = () => {
    const el = $("#ye-recent"); if (!el) return;
    const b = Batches.latest("yearend");
    if (!b) { el.innerHTML = ""; el.style.display = "none"; return; }
    el.style.display = "flex";
    el.innerHTML = `<span class="dot"></span><span>${esc(t("yearend.recent", { n: b.meta?.n ?? (b.rows || []).length, y: b.meta?.taxYear || "—", when: relTime(b.createdAt), e: b.meta?.errors ?? 0 }))}</span>
      <button type="button" class="small-link" id="ye-recent-open">${esc(t("yearend.recentOpen"))}</button>`;
    $("#ye-recent-open")?.addEventListener("click", () => {
      fromBatch = true;
      lastResult = resultFromBatch(b);
      $("#ye-year").value = String(lastResult.taxYear);
      render(lastResult);
      status(null, () => t("yearend.statusFromBatch", { n: lastResult.rows.length, when: relTime(b.createdAt) }));
    });
  };
  renderRecent();
  // Any batch change: a new 연말정산 run (recent strip) or a new claims batch (cross-check card re-derived).
  Batches.onChange(() => { renderRecent(); if (lastResult) render(lastResult); lookup(); });

  // ── 환자 문의 대응 — pid lookup against the latest yearend batch ──
  const pidInput = $("#ye-lookup-pid");
  const fillPidList = () => {
    const dl = $("#ye-lookup-list"); if (!dl) return;
    dl.innerHTML = Patients.list().map(p => `<option value="${esc(p.pid)}">${esc(p.alias)}</option>`).join("");
  };
  fillPidList();
  Patients.onChange(fillPidList);
  const DOC_CTX = (pid) => ({ pid, create: true, docType: "영수증 재발급" });
  function lookup() {
    const out = $("#ye-lookup-out"); if (!out) return;
    const pid = String(pidInput?.value || "").trim();
    if (!pid) { out.innerHTML = `<div class="empty-state small">${esc(t("yearend.lookup.empty"))}</div>`; return; }
    const b = Batches.latest("yearend");
    const alias = Patients.alias(pid);
    const known = !!Patients.get(pid);
    if (!b) { out.innerHTML = `<div class="status-line warn" style="display:flex"><span class="dot"></span><span>${esc(t("yearend.lookup.noBatch", { who: alias }))}</span></div>`; return; }
    const rows = (b.rows || []).filter(r => String(r.pid || "").trim() === pid);
    const total = rows.reduce((s, r) => s + (+r.total || 0), 0), own = rows.reduce((s, r) => s + (+r.own || 0), 0), non = rows.reduce((s, r) => s + (+r.non || 0), 0);
    const errs = rows.filter(r => r.verdict === "error").length;
    const y = b.meta?.taxYear || "—";
    const ctx = JSON.stringify(DOC_CTX(pid));
    out.innerHTML = `
      <div class="ye-lookup-card ${rows.length ? "found" : "missing"}" data-pid="${esc(pid)}">
        <div class="ye-lookup-head"><span class="code">${esc(alias)}</span> ${known ? "" : `<span class="pill warn">${esc(t("yearend.lookup.unknownPid"))}</span>`}
          <span class="pill ${rows.length ? "ok" : "err"}">${esc(rows.length ? t("yearend.lookup.inBatch", { y }) : t("yearend.lookup.notInBatch", { y }))}</span></div>
        ${rows.length ? `<div class="ye-lookup-grid">
          <div><span class="k">${esc(t("yearend.thCount"))}</span><span class="v">${rows.length}</span></div>
          <div><span class="k">${esc(t("yearend.thSum"))}</span><span class="v">${esc(won(total))}</span></div>
          <div><span class="k">${esc(t("yearend.thOwn"))}</span><span class="v">${esc(won(own))}</span></div>
          <div><span class="k">${esc(t("yearend.thNon"))}</span><span class="v">${esc(won(non))}</span></div>
          <div><span class="k">${esc(t("yearend.thLevel"))}</span><span class="v">${errs ? `<span class="pill err">${esc(t("yearend.errBadge", { n: errs }))}</span>` : `<span class="pill ok">${esc(t("yearend.v.ok"))}</span>`}</span></div>
        </div>
        <ul class="ye-lookup-visits">${rows.slice(0, 8).map(r => `<li><span class="code">${esc(r.date)}</span> · ${esc(won(r.total))}${r.verdict === "error" ? ` · <span class="pill err">${esc(verdictText("error"))}</span>` : ""}</li>`).join("")}${rows.length > 8 ? `<li class="more">${esc(t("yearend.xc.more", { n: rows.length - 8 }))}</li>` : ""}</ul>` : `<p class="caveat" style="margin:6px 0 10px">${esc(t("yearend.lookup.missingHint"))}</p>`}
        <div class="ye-lookup-actions">
          <button type="button" class="btn" id="ye-lookup-docs" data-ctx='${esc(ctx)}'>${esc(t("yearend.lookup.docsBtn"))} <span class="arrow">→</span></button>
          <span class="caveat">${esc(t("yearend.lookup.docsHint"))}</span>
        </div>
      </div>`;
    $("#ye-lookup-docs")?.addEventListener("click", () => {
      const c = DOC_CTX(pid);
      Patients.ensure(pid, { tags: ["연말정산"] });
      ActivityLog.push("yearend", t("yearend.lookup.log"), { pid });
      if (document.getElementById("tab-docs")) activateTab("tab-docs", c);
      else Toast.show({ tag: "system", html: esc(t("yearend.lookup.docsSoon")) });
    });
  }
  $("#ye-lookup-btn")?.addEventListener("click", lookup);
  pidInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); lookup(); } });
  pidInput?.addEventListener("change", lookup);
  lookup();

  const finish = (result, statusFn) => {
    fromBatch = false;
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
      storeBatch(result, { fileName: file.name });
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
    const org = Org.get();
    const biz = String(org.biz || "biz").replace(/-/g, "");
    const rows = lastResult.rows.map(r => headerRow([
      ...orgHeaderPairs(org), ["yearend.col.row", r.row], ["yearend.col.name", fromBatch ? Patients.alias(r.pid) : r.name], ["yearend.col.pid", r.pid || ""],
      ["yearend.col.rrn", fromBatch ? "—" : r.masked], ["yearend.col.date", r.date],
      ["yearend.col.total", r.total], ["yearend.col.own", r.own], ["yearend.col.non", r.non], ["yearend.col.verdict", verdictText(r.verdict)], ["yearend.col.notes", rowNotes(r)]
    ]));
    downloadCSV(rows, t("yearend.file", { biz, date: todayISO().replace(/-/g, "") })); // watermark + _PoC applied inside
    ActivityLog.push("yearend", t("yearend.logDl", { n: rows.length }), {});
  });

  // Sample: the five shared demo patients (fictional names/RRNs live ONLY in this file). Month/day match the
  // shared 2026-08 claims sample (data/jabo-sample-claims.json: M2608-0001 · 0002 · 0006 · 0008 · 0012) so the
  // cross-check finds 5 overlaps, 7 claims-only visits and 1 file-only visit when the tax year is the batch's year
  // (seed() aligns it). The set deliberately keeps one bad RRN (12 digits), one negative amount and one duplicate
  // row. Column headers are the Korean EMR-export names the validator expects (data, not UI copy); 환자번호 is the
  // optional column the claims cross-check joins on.
  const sampleYeData = () => {
    const y = taxYear();
    return [
      { 환자번호: "P-2026-0142", 환자성명: "김민지", 주민등록번호: "880314-2123458", 진료일자: `${y}-08-04`, 본인부담금: 12000, 비급여금액: 38000 },
      { 환자번호: "P-2026-0142", 환자성명: "김민지", 주민등록번호: "880314-2123458", 진료일자: `${y}-08-07`, 본인부담금: 12000, 비급여금액: 0 },
      { 환자번호: "P-2026-0233", 환자성명: "박지훈", 주민등록번호: "750822-1234569", 진료일자: `${y}-08-05`, 본인부담금: 18000, 비급여금액: 80000 },
      { 환자번호: "P-2026-0233", 환자성명: "박지훈", 주민등록번호: "750822-1234569", 진료일자: `${y}-08-05`, 본인부담금: 18000, 비급여금액: 80000 },
      { 환자번호: "P-2026-0301", 환자성명: "이서윤", 주민등록번호: "920506-265432",  진료일자: `${y}-08-06`, 본인부담금: 15000, 비급여금액: 120000 },
      { 환자번호: "P-2026-0418", 환자성명: "최다은", 주민등록번호: "010912-4123452", 진료일자: `${y}-09-03`, 본인부담금: -9000, 비급여금액: 45000 },
      { 환자번호: "P-2026-0509", 환자성명: "정하늘", 주민등록번호: "830127-1234562", 진료일자: `${y}-08-27`, 본인부담금: 9000,  비급여금액: 20000 }
    ];
  };

  $('[data-action="sample-ye"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleYeData(), t("yearend.sampleFile", { y: $("#ye-year").value || "" }), t("common.sampleSheetShort"));
  });

  const runSample = () => {
    // Follow the current claims batch's year so the cross-check has something to join on.
    const batchYear = Batches.latest("claims")?.meta?.month?.slice(0, 4);
    if (batchYear && $("#ye-year").value !== batchYear) { $("#ye-year").value = batchYear; $("#ye-year").dispatchEvent(new Event("change", { bubbles: true })); }
    const result = validate(sampleYeData());
    storeBatch(result, { sample: true });
    ActivityLog.push("yearend", t("yearend.logSample", { n: result.rows.length }), { sample: true });
    finish(result, (errs) => t("yearend.statusSample", { e: errs }));
  };
  $('[data-action="run-ye"]').addEventListener("click", runSample);

  // Persist the tax year only (institution fields live in Org; uploaded rows are never persisted as such)
  if (!$("#ye-year").value) $("#ye-year").value = String(new Date().getFullYear() - 1);
  bindPersist("#ye-year", "yearend.ye-year");

  // Deadline click from 00 → { taxYear }
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-yearend") return;
    const ctx = p.ctx;
    if (ctx?.taxYear) {
      $("#ye-year").value = String(ctx.taxYear);
      $("#ye-year").dispatchEvent(new Event("change", { bubbles: true }));
      if (lastResult && lastResult.taxYear !== +ctx.taxYear) status("warn", () => t("yearend.statusYearChanged", { y: ctx.taxYear }));
    }
    // { pid } from 환자 (patients-shared) or the search overlay → run the 문의 대응 lookup for that patient.
    if (ctx?.pid && pidInput) { pidInput.value = String(ctx.pid); lookup(); $("#ye-lookup-out")?.scrollIntoView({ block: "center", behavior: "smooth" }); }
  });

  onLangChange(() => {
    renderOrg(); renderRecent(); lookup();
    if (lastResult) render(lastResult);
    if (lastStatus) setStatus($("#ye-status"), lastStatus.kind, lastStatus.fn());
  });

  api = { seed: runSample };
}
