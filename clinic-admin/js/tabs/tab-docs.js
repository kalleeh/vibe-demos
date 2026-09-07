/* clinic-admin — 환자 › 서류 발급 대장 — the issued-document ledger (진단서 등 발급 대장).

   DOMAIN (confidence in brackets). Front desks issue 진단서 · 진료확인서 · 입퇴원확인서 · 소견서 · 진료비 세부내역서 and
   re-issue 영수증 every day. A 진단서 등 발급 대장 is a statutory record — 의료법 §17 (who may issue) and 의료법 시행규칙
   (대장 서식 / 부본 보존) [medium — the duty is certain, the exact 시행규칙 article for the 대장 form is "확인 필요"]. 진단서
   and 소견서 may only be issued by a 한의사 [high — 의료법 §17]; the copy (부본) is kept 3 years [high — 시행규칙 §15].
   Certificate fees are 비급여 and must be posted at the counter [high — 의료법 §45]. Proxy pick-up needs a 위임장 and
   the proxy's ID [high — 의료법 §21 access rules].

   Record (Store key docs.list — encrypted, 3 years from the issue date, registered via lifecycle.registerRows):
     { id, no ("2026-0001" — sequential per year, assigned on first save), pid, docType, issuedAt, issuedBy (staffId —
       must be a 한의사 for 진단서/소견서), purpose, fee, copies, recipient: 본인|대리인, proxy: { poa, idChecked },
       note, createdAt, updatedAt }
   Values stored in Korean (docType · purpose · recipient); labels via docs.type.* / docs.purpose.* / docs.recipient.*.
   Fee: docFee(docType, items) picks the clinic's own 비급여 price when the tariff (조직 › 비급여) carries a matching
   certificate item; otherwise the fee is typed by hand (the seeded tariff has no certificate line — the hint says so).
   ctx handled: { pid } · { pid, create: true } · { id }. */
import { Toast, Haptic, todayISO, won } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { downloadXLSX, headerRow, orgHeader } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Org, Patients, Staff } from "../core/entities.js";
import { Session } from "../security/session.js";
import { registerRows } from "../security/lifecycle.js";
import { tariffRows } from "./claims-shared.js";
import { $, $$, esc, KEYS, collection, str, num, audit, renderTable, chipRow, onPanelCtx, renderPatientStrip, pidOptions, staffOptions, staffRef, staffJob, aliasOf, dash, openPrint, introHTML, flowHTML, flowState, paintFlowStatus } from "./patients-shared.js";

export const DOC_TYPES = ["진단서", "진료확인서", "입퇴원확인서", "소견서", "진료비 세부내역서", "영수증 재발급"];
const PURPOSES = ["보험 제출", "직장", "학교", "법원", "기타"];
const RECIPIENTS = ["본인", "대리인"];
const DOCTOR_ONLY = new Set(["진단서", "소견서"]);
const TAG = "docs";
const D = collection(KEYS.docs);

const issuedMs = (r) => { const d = Date.parse((r?.issuedAt || "") + "T00:00:00"); return Number.isFinite(d) ? d : (r?.createdAt || 0); };
registerRows([{
  id: "docs.list", key: KEYS.docs, match: (k) => k === KEYS.docs, label: "진단서 등 발급 대장",
  detail: "발급번호·환자번호(가명)·서류 종류·발급일·발급자(직원 id)·용도·수수료·부수·수령인 구분(본인/대리인 확인) — 환자 이름·주민번호 없음",
  purpose: "진단서 등 발급 기록 (법정 대장) · 제증명 수수료 집계",
  basis: "의료법 §17 · 의료법 시행규칙 (진단서 등 발급 대장 · 부본 3년 §15) — 서식 조문은 확인 필요 · PoC 문구",
  encrypted: true, retention: "발급일로부터 3년", days: 3 * 365,
  purge: (v, cutoff) => (Array.isArray(v) ? v.filter(r => issuedMs(r) >= cutoff) : v)
}]);

export const list = () => D.list();
export const get = (id) => D.get(id);
export const isDoctorOnly = (docType) => DOCTOR_ONLY.has(docType);
export const canIssue = (docType, staffId) => !DOCTOR_ONLY.has(docType) || staffJob(staffId) === "한의사";

/* Sequential 발급번호 per year: "2026-0001". `rows` lets the caller pass the current list (pure, testable). */
export function nextDocNo(year, rows = D.list()) {
  const y = String(year || new Date().getFullYear());
  let max = 0;
  for (const r of rows) { const m = /^(\d{4})-(\d{4})$/.exec(r.no || ""); if (m && m[1] === y) max = Math.max(max, +m[2]); }
  return `${y}-${String(max + 1).padStart(4, "0")}`;
}
/* Fee from the clinic's own tariff: the first priced item whose name contains the document type (spaces ignored).
   영수증 재발급 is free unless the tariff says otherwise. Returns { fee, code, name } or null. */
export function docFee(docType, items) {
  const key = String(docType || "").replace(/\s+/g, "");
  if (!key) return null;
  const hit = (items || []).find(it => String(it.name || "").replace(/\s+/g, "").includes(key) && it.price > 0);
  if (hit) return { fee: hit.price, code: hit.code, name: hit.name };
  if (docType === "영수증 재발급") return { fee: 0, code: "", name: "" };
  return null;
}
// The year-end (연말정산) hint: a receipt re-issued in January is almost always for the 간소화 data.
export const isYearendHint = (r) => r.docType === "영수증 재발급" && ((r.issuedAt || "").slice(5, 7) === "01" || new Date().getMonth() === 0);

const typeLabel = (v) => t("docs.type." + v);
const purposeLabel = (v) => t("docs.purpose." + v);
const recipientLabel = (v) => t("docs.recipient." + v);
const blank = (pid = "") => ({ id: "", no: "", pid, docType: "진단서", issuedAt: todayISO(), issuedBy: "", purpose: "보험 제출", fee: "", copies: 1, recipient: "본인", proxy: { poa: false, idChecked: false }, note: "" });

export function init({ DATA } = {}) {
  const host = $('#tab-docs [data-p3-slot="tab-docs"]');
  if (!host) return;
  const nameOf = (code) => { const it = (DATA?.bigeup?.items || []).find(x => x.code === code); return it ? pick(it, "name") : ""; };
  const tariffItems = () => tariffRows(nameOf);
  let filter = { pid: "", type: "", q: "" };
  let draft = null, highlightId = null, printMonth = "", flowSt = null;

  const months = () => [...new Set(D.list().map(r => (r.issuedAt || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const mount = () => {
    const ms = months(); if (!ms.includes(printMonth)) printMonth = ms[0] || todayISO().slice(0, 7);
    host.innerHTML = `${introHTML("docs")}${flowHTML("docs", {
      input: `<div class="actions"><button type="button" class="btn" data-new>${esc(t("docs.newBtn"))}</button><span class="p3-sub">${esc(t("docs.editorHint"))}</span></div>
        <div class="p3-editor" data-editor hidden></div>`,
      review: `<div class="p3-filter">
          <select class="p3-pid" data-f-pid aria-label="${esc(t("patients.filterPatient"))}"><option value="">${esc(t("patients.allPatients"))}</option>${pidOptions(filter.pid, { placeholder: false })}</select>
          <div class="search-filters p3-chips" data-chips>${chipRow(["", ...DOC_TYPES], filter.type, v => v === "" ? t("patients.all") : typeLabel(v))}</div>
          <input type="search" class="p3-search" data-f-q value="${esc(filter.q)}" placeholder="${esc(t("docs.searchPh"))}" aria-label="${esc(t("docs.searchPh"))}">
        </div>
        <div class="p3-strip" data-strip hidden></div>
        <div class="result p3-result" data-list></div>
        <div class="result-toolbar"><div class="summary" data-summary></div></div>
        <p class="caveat">${t("docs.caveat")}</p>`,
      exports: `<span class="act"><span class="act-k">${esc(t("docs.listH"))}</span><button type="button" class="btn" data-export>${t("flow.export.xlsx")}</button></span>
        <span class="act"><span class="act-k">${esc(t("docs.printMonth"))}</span><select data-print-month aria-label="${esc(t("docs.printMonth"))}">${(ms.length ? ms : [printMonth]).map(m => `<option value="${m}"${m === printMonth ? " selected" : ""}>${m}</option>`).join("")}</select><button type="button" class="btn secondary" data-print>${t("flow.export.print")}</button></span>`,
      next: { tab: "tab-yearend", labelKey: "nav.yearend" }
    })}`;
    paintFlowStatus(host, flowSt);
    host.querySelector("[data-f-pid]").addEventListener("change", (e) => { filter.pid = e.target.value; renderList(); renderStrip(); });
    host.querySelector("[data-chips]").addEventListener("click", (e) => { const b = e.target.closest("[data-chip]"); if (!b) return; filter.type = b.dataset.chip; $$("[data-chip]", host).forEach(x => x.classList.toggle("active", x === b)); renderList(); });
    host.querySelector("[data-f-q]").addEventListener("input", (e) => { filter.q = e.target.value; renderList(); });
    host.querySelector("[data-new]").addEventListener("click", () => openEditor(blank(filter.pid)));
    host.querySelector("[data-print-month]").addEventListener("change", (e) => { printMonth = e.target.value; });
    host.querySelector("[data-print]").addEventListener("click", printMonthly);
    host.querySelector("[data-export]").addEventListener("click", exportXLSX);
    host.querySelector("[data-list]").addEventListener("click", onRowAction);
    renderStrip(); renderList();
    if (draft) openEditor(draft);
  };

  const visible = () => {
    const q = filter.q.trim().toLowerCase();
    return D.list().filter(r => (!filter.pid || r.pid === filter.pid) && (!filter.type || r.docType === filter.type)
      && (!q || [r.no, r.purpose, r.note, purposeLabel(r.purpose)].some(v => String(v || "").toLowerCase().includes(q))))
      .sort((a, b) => (b.issuedAt || "").localeCompare(a.issuedAt || "") || (b.no || "").localeCompare(a.no || ""));
  };
  const renderList = () => {
    const rows = visible(), all = D.list();
    const month = todayISO().slice(0, 7);
    const thisMonth = all.filter(r => (r.issuedAt || "").startsWith(month));
    host.querySelector("[data-count]").textContent = t("patients.nRows", { n: all.length });
    host.querySelector("[data-summary]").textContent = t("docs.summary", { n: rows.length, m: thisMonth.length, fee: won(thisMonth.reduce((a, r) => a + num(r.fee) * (num(r.copies) || 1), 0)) });
    renderTable(host.querySelector("[data-list]"), {
      highlightId,
      empty: esc(Session.isUnlocked() ? t("docs.empty") : t("patients.locked")),
      columns: [
        { key: "no", label: t("docs.col.no"), cls: "code" }, { key: "issuedAt", label: t("docs.col.issuedAt"), cls: "code" },
        { key: "pid", label: t("patients.col.patient") }, { key: "type", label: t("docs.col.type") }, { key: "purpose", label: t("docs.col.purpose") },
        { key: "by", label: t("docs.col.issuedBy") }, { key: "copies", label: t("docs.col.copies"), cls: "code" }, { key: "fee", label: t("docs.col.fee"), cls: "code" },
        { key: "recipient", label: t("docs.col.recipient") }
      ],
      rows: rows.map(r => ({
        id: r.id, cls: r.recipient === "대리인" && !(r.proxy?.poa && r.proxy?.idChecked) ? "warn" : "",
        cells: {
          no: `<strong>${esc(dash(r.no))}</strong>`, issuedAt: esc(dash(r.issuedAt)),
          pid: `<strong>${esc(aliasOf(r.pid))}</strong>`,
          type: `${esc(typeLabel(r.docType))}${DOCTOR_ONLY.has(r.docType) ? ` <span class="pill info p3-badge">${esc(t("docs.doctorOnlyPill"))}</span>` : ""}`,
          purpose: esc(purposeLabel(r.purpose)) + (r.note ? `<div class="p3-sub">${esc(r.note)}</div>` : ""),
          by: esc(staffRef(r.issuedBy)),
          copies: esc(String(r.copies || 1)),
          fee: r.fee === "" || r.fee == null ? "—" : esc(won(num(r.fee))),
          recipient: r.recipient === "대리인"
            ? `${esc(recipientLabel(r.recipient))}<div class="p3-sub">${esc(t("docs.proxyPoa"))} ${r.proxy?.poa ? "✓" : "✗"} · ${esc(t("docs.proxyId"))} ${r.proxy?.idChecked ? "✓" : "✗"}</div>`
            : esc(recipientLabel(r.recipient))
        },
        actions: `
          <button type="button" class="row-act" data-act="edit" title="${esc(t("common.edit"))}">✎</button>
          ${isYearendHint(r) ? `<button type="button" class="row-act accent" data-act="yearend" title="${esc(t("docs.yearendHintTitle"))}">${esc(t("docs.yearendHint"))}</button>` : ""}
          <button type="button" class="row-act" data-act="del" title="${esc(t("common.delete"))}">×</button>`
      }))
    });
    highlightId = null;
  };
  const renderStrip = () => renderPatientStrip(host.querySelector("[data-strip]"), filter.pid, { self: "tab-docs" });

  function onRowAction(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.closest("tr")?.dataset.id; const r = id && D.get(id); if (!r) return;
    if (b.dataset.act === "edit") openEditor(r);
    else if (b.dataset.act === "yearend") activateTab("tab-yearend");
    else if (b.dataset.act === "del") {
      const removed = D.remove(r.id); if (!removed) return;
      if (draft?.id === r.id) closeEditor();
      audit(TAG, t("docs.logDelete", { no: r.no }), r.pid, { silent: true });
      Haptic.del();
      Toast.withUndo(t("docs.removedToast", { no: r.no, who: aliasOf(r.pid) }), () => { D.insert(removed.row, removed.index); audit(TAG, t("docs.logUndo", { no: r.no }), r.pid, { silent: true }); }, TAG);
    }
  }

  /* ── inline editor ── */
  const field = (label, inner, cls = "") => `<div class="field ${cls}"><label>${esc(label)}</label>${inner}</div>`;
  function openEditor(rec) {
    draft = JSON.parse(JSON.stringify(rec));
    const ed = host.querySelector("[data-editor]");
    ed.hidden = false;
    const proxy = draft.recipient === "대리인";
    ed.innerHTML = `
      <h5>${esc(draft.id ? t("docs.editH", { no: draft.no }) : t("docs.newH", { no: nextDocNo((draft.issuedAt || todayISO()).slice(0, 4)) }))}</h5>
      <div class="form-grid p3-grid">
        ${field(t("patients.col.patient"), `<select data-e="pid">${pidOptions(draft.pid, { extra: [draft.pid] })}</select>`)}
        ${field(t("docs.col.type"), `<select data-e="docType">${DOC_TYPES.map(v => `<option value="${v}"${v === draft.docType ? " selected" : ""}>${esc(typeLabel(v))}</option>`).join("")}</select>`)}
        ${field(t("docs.col.issuedAt"), `<input type="date" data-e="issuedAt" value="${esc(draft.issuedAt)}">`)}
        ${field(t("docs.col.issuedBy"), `<select data-e="issuedBy">${staffOptions(draft.issuedBy)}</select><span class="p3-sub" data-issuer-hint>${esc(DOCTOR_ONLY.has(draft.docType) ? t("docs.issuerDoctorHint") : "")}</span>`)}
        ${field(t("docs.col.purpose"), `<select data-e="purpose">${PURPOSES.map(v => `<option value="${v}"${v === draft.purpose ? " selected" : ""}>${esc(purposeLabel(v))}</option>`).join("")}</select>`)}
        ${field(t("docs.col.fee"), `<input type="number" min="0" step="100" data-e="fee" value="${esc(draft.fee)}" placeholder="0"><span class="p3-sub" data-fee-hint></span>`)}
        ${field(t("docs.col.copies"), `<input type="number" min="1" max="20" data-e="copies" value="${esc(draft.copies || 1)}">`)}
        ${field(t("docs.col.recipient"), `<select data-e="recipient">${RECIPIENTS.map(v => `<option value="${v}"${v === draft.recipient ? " selected" : ""}>${esc(recipientLabel(v))}</option>`).join("")}</select>`)}
        <div class="field p3-span2" data-proxy-row ${proxy ? "" : "hidden"}><label>${esc(t("docs.proxyChecksH"))}</label>
          <div class="p3-checks">
            <label><input type="checkbox" data-proxy="poa"${draft.proxy?.poa ? " checked" : ""}> ${esc(t("docs.proxyPoaLong"))}</label>
            <label><input type="checkbox" data-proxy="idChecked"${draft.proxy?.idChecked ? " checked" : ""}> ${esc(t("docs.proxyIdLong"))}</label>
          </div></div>
        ${field(t("common.thNote"), `<input type="text" data-e="note" value="${esc(draft.note || "")}" placeholder="${esc(t("docs.notePh"))}">`, "p3-span2")}
      </div>
      <div class="p3-editor-actions">
        <button type="button" class="btn" data-save>${esc(t("common.save"))}</button>
        <button type="button" class="btn secondary" data-cancel>${esc(t("common.cancel"))}</button>
        <span class="p3-sub">${esc(t("docs.editorHint"))}</span>
      </div>`;
    const feeHint = (force) => {
      const type = ed.querySelector('[data-e="docType"]').value, feeEl = ed.querySelector('[data-e="fee"]');
      const hit = docFee(type, tariffItems());
      if (hit && (force || feeEl.value === "")) feeEl.value = hit.fee;
      ed.querySelector("[data-fee-hint]").textContent = hit && hit.code ? t("docs.feeFromTariff", { name: hit.name, price: won(hit.fee) }) : t("docs.feeManualHint");
      ed.querySelector("[data-issuer-hint]").textContent = DOCTOR_ONLY.has(type) ? t("docs.issuerDoctorHint") : "";
    };
    ed.querySelector('[data-e="docType"]').addEventListener("change", () => feeHint(true));
    ed.querySelector('[data-e="recipient"]').addEventListener("change", (e) => { ed.querySelector("[data-proxy-row]").hidden = e.target.value !== "대리인"; });
    ed.querySelector("[data-save]").addEventListener("click", save);
    ed.querySelector("[data-cancel]").addEventListener("click", () => { closeEditor(); Haptic.tap(); });
    feeHint(false);
    ed.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const focusSel = draft.pid ? '[data-e="docType"]' : '[data-e="pid"]'; setTimeout(() => ed.querySelector(focusSel)?.focus({ preventScroll: true }), 40);
  }
  function readForm() {
    const ed = host.querySelector("[data-editor]");
    for (const el of ed.querySelectorAll("[data-e]")) draft[el.dataset.e] = str(el.value);
    draft.copies = Math.max(1, num(draft.copies) || 1);
    draft.proxy = { poa: ed.querySelector('[data-proxy="poa"]').checked, idChecked: ed.querySelector('[data-proxy="idChecked"]').checked };
    return draft;
  }
  function closeEditor() { draft = null; const ed = host.querySelector("[data-editor]"); ed.hidden = true; ed.innerHTML = ""; }
  function save() {
    readForm();
    if (!draft.pid) { Toast.show({ tag: TAG, html: esc(t("patients.errPid")) }); Haptic.warn(); return; }
    if (!draft.issuedBy) { Toast.show({ tag: TAG, html: esc(t("docs.errIssuerMissing")) }); Haptic.warn(); return; }
    if (!canIssue(draft.docType, draft.issuedBy)) { Toast.show({ tag: TAG, html: esc(t("docs.errIssuer", { type: typeLabel(draft.docType) })) }); Haptic.warn(); return; }
    if (draft.recipient === "대리인" && !(draft.proxy.poa && draft.proxy.idChecked)) { Toast.show({ tag: TAG, html: esc(t("docs.errProxy")) }); Haptic.warn(); return; }
    const isNew = !draft.id;
    try {
      if (isNew) draft.no = nextDocNo((draft.issuedAt || todayISO()).slice(0, 4));
      Patients.ensure(draft.pid); if (draft.issuedAt) Patients.touch(draft.pid, draft.issuedAt);
      const saved = D.upsert(draft);
      audit(TAG, t(isNew ? "docs.logAdd" : "docs.logEdit", { no: saved.no, type: typeLabel(saved.docType) }), saved.pid);
      highlightId = saved.id;
      flowSt = flowState("flow.state.saved", D.list().length);
    } catch (err) { Toast.show({ tag: TAG, html: esc(err.message || String(err)) }); Haptic.warn(); return; }
    Haptic.save();
    closeEditor();
    mount(); // the month list in the toolbar may have gained a month
  }

  /* ── exports ── */
  const rowsForExport = (rows) => rows.map(r => headerRow([...orgHeader(),
    ["docs.col.no", r.no || ""], ["docs.col.issuedAt", r.issuedAt || ""], ["patients.col.patient", aliasOf(r.pid)], ["docs.col.type", typeLabel(r.docType)],
    ["docs.col.purpose", purposeLabel(r.purpose)], ["docs.col.issuedBy", staffRef(r.issuedBy)], ["docs.col.copies", num(r.copies) || 1], ["docs.col.fee", r.fee === "" ? "" : num(r.fee)],
    ["docs.col.recipient", recipientLabel(r.recipient)], ["docs.proxyPoa", r.recipient === "대리인" ? (r.proxy?.poa ? "Y" : "N") : ""], ["docs.proxyId", r.recipient === "대리인" ? (r.proxy?.idChecked ? "Y" : "N") : ""],
    ["common.thNote", r.note || ""]
  ]));
  function exportXLSX() {
    const rows = visible();
    if (!rows.length) { Toast.show({ tag: TAG, html: esc(t("docs.empty")) }); return; }
    downloadXLSX(rowsForExport(rows), t("docs.fileName", { date: todayISO() }), t("docs.sheetName"));
    audit(TAG, t("docs.logExport", { n: rows.length }), null);
  }
  // Printable monthly 대장 — the statutory register page for one month (PoC layout; the real form follows the hospital's own 양식).
  function printMonthly() {
    const rows = D.list().filter(r => (r.issuedAt || "").startsWith(printMonth)).sort((a, b) => (a.no || "").localeCompare(b.no || ""));
    if (!rows.length) { Toast.show({ tag: TAG, html: esc(t("docs.printEmpty", { m: printMonth })) }); return; }
    const o = Org.get();
    const body = `
      <h5>${esc(t("docs.printTitle", { m: printMonth }))}</h5>
      <p>${esc(o.name || "—")}${o.ykiho ? ` · ${esc(t("org.col.ykiho"))} ${esc(o.ykiho)}` : ""} · ${esc(t("docs.printCount", { n: rows.length }))}</p>
      <table><thead><tr>
        <th>${esc(t("docs.col.no"))}</th><th>${esc(t("docs.col.issuedAt"))}</th><th>${esc(t("patients.col.patient"))}</th><th>${esc(t("docs.col.type"))}</th>
        <th>${esc(t("docs.col.purpose"))}</th><th>${esc(t("docs.col.issuedBy"))}</th><th>${esc(t("docs.col.copies"))}</th><th>${esc(t("docs.col.fee"))}</th><th>${esc(t("docs.col.recipient"))}</th>
      </tr></thead><tbody>
        ${rows.map(r => `<tr><td class="code">${esc(r.no)}</td><td class="code">${esc(r.issuedAt)}</td><td>${esc(aliasOf(r.pid))}</td><td>${esc(typeLabel(r.docType))}</td><td>${esc(purposeLabel(r.purpose))}</td><td>${esc(staffRef(r.issuedBy))}</td><td class="code">${esc(String(r.copies || 1))}</td><td class="code">${r.fee === "" ? "—" : esc(won(num(r.fee)))}</td><td>${esc(recipientLabel(r.recipient))}${r.recipient === "대리인" ? ` <span class="muted">(${esc(t("docs.proxyPoa"))} ${r.proxy?.poa ? "✓" : "✗"} · ${esc(t("docs.proxyId"))} ${r.proxy?.idChecked ? "✓" : "✗"})</span>` : ""}</td></tr>`).join("")}
      </tbody></table>
      <p class="muted">${esc(t("docs.printFoot"))}</p>`;
    openPrint(t("docs.printTitle", { m: printMonth }), body);
    audit(TAG, t("docs.logPrint", { m: printMonth }), null);
  }

  /* ── wiring ── */
  mount();
  host.addEventListener("click", (e) => {
    if (!e.target.closest('[data-action="run-docs"]')) return;
    seed(); filter = { pid: "", type: "", q: "" }; flowSt = flowState("flow.state.demo", D.list().length); mount();
  });
  D.onChange(() => { renderList(); renderStrip(); });
  Patients.onChange(() => { const sel = host.querySelector("[data-f-pid]"); if (sel) sel.innerHTML = `<option value="">${esc(t("patients.allPatients"))}</option>` + pidOptions(filter.pid, { placeholder: false }); renderStrip(); renderList(); });
  Staff.onChange(() => renderList());
  onPanelCtx("tab-docs", {
    onPid: (pid) => { filter.pid = pid; mount(); },
    onCreate: (c) => { filter.pid = c.pid || filter.pid; mount(); openEditor({ ...blank(c.pid || ""), ...(c.docType && DOC_TYPES.includes(c.docType) ? { docType: c.docType } : {}) }); },
    onId: (id) => { const r = D.get(id); if (!r) return; filter.pid = ""; filter.type = ""; highlightId = id; mount(); openEditor(r); }
  });
  onLangChange(() => { const d = draft ? readForm() : null; draft = null; mount(); if (d) openEditor(d); });
}

/* ── seed — four documents for the shared clinic (staff by name from the seeded roster: 윤지훈 · 박서연 한의사, 한지우 원무) ── */
export function seed() {
  if (!Session.isUnlocked()) return;
  const have = new Set(D.list().map(r => r.id));
  const staff = Staff.list();
  const byName = (name, job) => staff.find(s => s.name === name && (!job || s.job === job))?.id || staff.find(s => s.job === (job || "한의사"))?.id || Session.user()?.staffId || null;
  const yoon = byName("윤지훈", "한의사"), park = byName("박서연", "한의사"), han = byName("한지우", "원무");
  const rows = [
    { id: "seed-doc-0301", no: "2026-0001", pid: "P-2026-0301", docType: "영수증 재발급", issuedAt: "2026-01-15", issuedBy: han, purpose: "기타", fee: 0, copies: 1, recipient: "본인", proxy: { poa: false, idChecked: false }, note: "연말정산 간소화 누락분 재발급" },
    { id: "seed-doc-0142", no: "2026-0002", pid: "P-2026-0142", docType: "진단서", issuedAt: "2026-08-05", issuedBy: yoon, purpose: "보험 제출", fee: 20000, copies: 2, recipient: "본인", proxy: { poa: false, idChecked: false }, note: "자보 삼성화재 제출용 · 경추 염좌 2주" },
    { id: "seed-doc-0418", no: "2026-0003", pid: "P-2026-0418", docType: "소견서", issuedAt: "2026-08-08", issuedBy: park, purpose: "보험 제출", fee: 10000, copies: 1, recipient: "대리인", proxy: { poa: true, idChecked: true }, note: "배우자 대리 수령 · 위임장 원본 보관" },
    { id: "seed-doc-0233", no: "2026-0004", pid: "P-2026-0233", docType: "진료확인서", issuedAt: "2026-08-19", issuedBy: han, purpose: "직장", fee: 3000, copies: 1, recipient: "본인", proxy: { poa: false, idChecked: false }, note: "" }
  ];
  for (const r of rows) if (!have.has(r.id)) { Patients.ensure(r.pid); Patients.touch(r.pid, r.issuedAt); D.upsert({ ...r, createdAt: Date.parse(r.issuedAt + "T10:00:00") }); }
}
