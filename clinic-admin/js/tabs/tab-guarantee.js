/* clinic-admin — 환자 › 자보 지불보증 — payment-guarantee tracker for auto-insurance (자보) patients.

   DOMAIN (confidence in brackets). A 자보 patient arrives with a 사고접수번호 and the insurer's name; 원무 obtains a
   지불보증 (payment guarantee: 지불보증서 / 승인번호, the covered scope, the covered period, the adjuster's phone/fax)
   by phone or fax before the insurer pays the 진료비 [high — everyday practice under 자동차손해배상 보장법 §12 and the
   자동차보험진료수가 기준]. Friction specific to 한방: pushback on 입원 일수 and on 약침·첩약 frequency [medium — widely
   reported, no single statutory rule]. A guarantee routinely expires mid-course and every extension is another call
   [high]. Nothing here is a claim — claims live in 청구 › 심사결과 대조; this panel is the front desk's call log.

   Record (Store key guarantee.list — encrypted, 1 year after the guarantee ends, registered via lifecycle.registerRows):
     { id, pid, insurer (Insurers value), accidentDate, claimNo, guaranteeNo, scope: { out, inp, herb }, from, to,
       contact: { name, phone, fax } (the INSURER's adjuster — a business contact, not a patient), status, log: [{ at,
       actor (staffId), kind: 전화|팩스|메모, text }], note, createdAt, updatedAt }
   Status values stay Korean (stored): 요청중 · 보증 · 연장요청 · 만료 · 거절; labels via guarantee.status.*.
   guaranteeState(row) / guaranteeDeadlines() live in patients-shared.js (홈 reads them there); this module re-exports them
   and registers guaranteeDeadlines as a core/calendar.js deadline source at load, so 홈's todo, the D-day list, the topbar
   chip and the .ics export carry every expiring / expired guarantee ({ key: "guar-<id>", label, due, ctx: { guaranteeId } }).
   ctx handled: { pid } (filter + strip) · { pid, create: true } (editor prefilled) · { id } | { guaranteeId } (highlight + editor). */
import { Toast, Haptic, todayISO } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { downloadXLSX, headerRow, orgHeader } from "../core/files.js";
import { registerDeadlineSource } from "../core/calendar.js";
import { activateTab } from "../core/nav.js";
import { Patients, Insurers } from "../core/entities.js";
import { Session } from "../security/session.js";
import { registerRows } from "../security/lifecycle.js";
import { $, $$, esc, KEYS, collection, str, audit, renderTable, chipRow, onPanelCtx, renderPatientStrip, pidOptions, staffRef, insurerOptions, insurerLabel, aliasOf, dash, dLabel, addDays, introHTML, flowHTML, flowState, paintFlowStatus,
         guaranteeState, guaranteeDeadlines, GUARANTEE_STATUSES as STATUSES, GUARANTEE_ACTIVE as ACTIVE } from "./patients-shared.js";

export { guaranteeState, guaranteeDeadlines };
const LOG_KINDS = ["전화", "팩스", "메모"];
const TAG = "guarantee";
const G = collection(KEYS.guarantee);
registerDeadlineSource(guaranteeDeadlines, { link: "tab-guarantee", kind: "guarantee" });

// Retention basis: the guarantee end date when known, else the record's creation — 1 year after that the row is purged.
const basisMs = (r) => { const d = r?.to ? Date.parse(r.to + "T00:00:00") : NaN; return Number.isFinite(d) ? d : (r?.createdAt || 0); };
registerRows([{
  id: "guarantee.list", key: KEYS.guarantee, match: (k) => k === KEYS.guarantee, label: "자보 지불보증 대장",
  detail: "환자번호(가명)·보험사·사고접수번호·보증번호·보증 범위·기간·보험사 담당자 연락처·통화 기록 — 환자 이름·주민번호 없음",
  purpose: "자보 지불보증 상태·만료·연장 추적 (원무 통화 기록)",
  basis: "자동차손해배상 보장법 §12 진료수가 청구 준비 · 개인정보보호법 §15①4 (계약 이행) — PoC 문구",
  encrypted: true, retention: "보증 종료 후 1년", days: 365,
  purge: (v, cutoff) => (Array.isArray(v) ? v.filter(r => basisMs(r) >= cutoff) : v)
}]);

export const list = () => G.list();
export const get = (id) => G.get(id);

/* ── panel ── */
const statusLabel = (s) => t("guarantee.status." + s);
const kindLabel = (k) => t("guarantee.kind." + k);
const scopeText = (sc) => [sc?.out && t("guarantee.scope.out"), sc?.inp && t("guarantee.scope.inp"), sc?.herb && t("guarantee.scope.herb")].filter(Boolean).join(" · ") || "—";
const blank = (pid = "") => ({ id: "", pid, insurer: Insurers.lastUsed() || "", accidentDate: "", claimNo: "", guaranteeNo: "", scope: { out: true, inp: false, herb: false }, from: todayISO(), to: "", contact: { name: "", phone: "", fax: "" }, status: "요청중", log: [], note: "" });

export function init() {
  const host = $('#tab-guarantee [data-p3-slot="tab-guarantee"]');
  if (!host) return;
  let filter = { pid: "", status: "", q: "" };
  let draft = null;          // editor state (null = closed)
  let highlightId = null, flowSt = null;

  const mount = () => {
    host.innerHTML = `${introHTML("guarantee")}${flowHTML("guarantee", {
      input: `<div class="actions"><button type="button" class="btn" data-new>${esc(t("guarantee.newBtn"))}</button><span class="p3-sub">${esc(t("guarantee.editorHint"))}</span></div>
        <div class="p3-editor" data-editor hidden></div>`,
      review: `<div class="p3-filter">
          <select class="p3-pid" data-f-pid aria-label="${esc(t("patients.filterPatient"))}"><option value="">${esc(t("patients.allPatients"))}</option>${pidOptions(filter.pid, { placeholder: false })}</select>
          <div class="search-filters p3-chips" data-chips>${chipRow(["", ...STATUSES, "soon"], filter.status, v => v === "" ? t("patients.all") : v === "soon" ? t("guarantee.chipSoon") : statusLabel(v))}</div>
          <input type="search" class="p3-search" data-f-q value="${esc(filter.q)}" placeholder="${esc(t("guarantee.searchPh"))}" aria-label="${esc(t("guarantee.searchPh"))}">
        </div>
        <div class="p3-strip" data-strip hidden></div>
        <div class="result p3-result" data-list></div>
        <div class="result-toolbar"><div class="summary" data-summary></div></div>
        <p class="caveat">${t("guarantee.caveat")}</p>`,
      exports: `<span class="act"><span class="act-k">${esc(t("guarantee.listH"))}</span><button type="button" class="btn" data-export>${t("flow.export.xlsx")}</button></span>`,
      next: { tab: "tab-jabo", labelKey: "nav.jabo" }
    })}`;
    paintFlowStatus(host, flowSt);
    host.querySelector("[data-f-pid]").addEventListener("change", (e) => { filter.pid = e.target.value; renderList(); renderStrip(); });
    host.querySelector("[data-chips]").addEventListener("click", (e) => { const b = e.target.closest("[data-chip]"); if (!b) return; filter.status = b.dataset.chip; $$("[data-chip]", host).forEach(x => x.classList.toggle("active", x === b)); renderList(); });
    host.querySelector("[data-f-q]").addEventListener("input", (e) => { filter.q = e.target.value; renderList(); });
    host.querySelector("[data-new]").addEventListener("click", () => openEditor(blank(filter.pid)));
    host.querySelector("[data-export]").addEventListener("click", exportXLSX);
    host.querySelector("[data-list]").addEventListener("click", onRowAction);
    renderStrip(); renderList();
    if (draft) openEditor(draft);
  };

  const visible = () => {
    const q = filter.q.trim().toLowerCase();
    return G.list().filter(r => (!filter.pid || r.pid === filter.pid)
      && (!filter.status || (filter.status === "soon" ? guaranteeState(r) === "expiring" : r.status === filter.status))
      && (!q || [r.claimNo, r.guaranteeNo, insurerLabel(r.insurer), r.insurer, r.contact?.name].some(v => String(v || "").toLowerCase().includes(q))))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  };
  const statePill = (r) => {
    const st = guaranteeState(r);
    const base = `<span class="pill ${r.status === "거절" ? "err" : r.status === "만료" ? "" : ACTIVE.has(r.status) ? "ok" : "info"}">${esc(statusLabel(r.status))}</span>`;
    if (st === "expired") return base + ` <span class="pill err p3-badge">${esc(t("guarantee.badgeExpired"))}</span>`;
    if (st === "expiring") return base + ` <span class="pill warn p3-badge">${esc(t("guarantee.badgeExpiring", { d: dLabel(r.to) }))}</span>`;
    return base;
  };
  const renderList = () => {
    const rows = visible(), all = G.list();
    const soon = all.filter(r => guaranteeState(r) === "expiring").length, expired = all.filter(r => guaranteeState(r) === "expired").length;
    host.querySelector("[data-count]").textContent = t("patients.nRows", { n: all.length });
    host.querySelector("[data-summary]").textContent = t("guarantee.summary", { n: rows.length, soon, expired });
    renderTable(host.querySelector("[data-list]"), {
      highlightId,
      empty: esc(Session.isUnlocked() ? t("guarantee.empty") : t("patients.locked")),
      columns: [
        { key: "pid", label: t("patients.col.patient") }, { key: "insurer", label: t("guarantee.col.insurer") },
        { key: "claim", label: t("guarantee.col.claim"), cls: "code" }, { key: "scope", label: t("guarantee.col.scope") },
        { key: "period", label: t("guarantee.col.period"), cls: "code" }, { key: "status", label: t("guarantee.col.status") },
        { key: "log", label: t("guarantee.col.log") }
      ],
      rows: rows.map(r => ({
        id: r.id, cls: guaranteeState(r) || "",
        cells: {
          pid: `<strong>${esc(aliasOf(r.pid))}</strong>`,
          insurer: `${esc(insurerLabel(r.insurer))}${r.contact?.name || r.contact?.phone ? `<div class="p3-sub">${esc([r.contact.name, r.contact.phone, r.contact.fax && `F ${r.contact.fax}`].filter(Boolean).join(" · "))}</div>` : ""}`,
          claim: `${esc(dash(r.claimNo))}${r.guaranteeNo ? `<div class="p3-sub">${esc(t("guarantee.noShort", { no: r.guaranteeNo }))}</div>` : ""}`,
          scope: esc(scopeText(r.scope)),
          period: `${esc(dash(r.from))} → ${esc(dash(r.to))}${r.to ? `<div class="p3-sub">${esc(dLabel(r.to))}</div>` : ""}`,
          status: statePill(r),
          log: r.log?.length ? `<span class="p3-sub">${esc(t("guarantee.logCount", { n: r.log.length }))}</span><div class="p3-sub">${esc(kindLabel(r.log[r.log.length - 1].kind))} · ${esc(r.log[r.log.length - 1].text)}</div>` : "—"
        },
        actions: `
          <button type="button" class="row-act" data-act="edit" title="${esc(t("common.edit"))}">✎</button>
          ${r.status !== "거절" ? `<button type="button" class="row-act accent" data-act="extend">${esc(t("guarantee.extendBtn"))}</button>` : ""}
          <button type="button" class="row-act" data-act="case">${esc(t("guarantee.openCase"))}</button>
          <button type="button" class="row-act" data-act="recon">${esc(t("guarantee.openRecon"))}</button>
          <button type="button" class="row-act" data-act="del" title="${esc(t("common.delete"))}">×</button>`
      }))
    });
    highlightId = null;
  };
  const renderStrip = () => renderPatientStrip(host.querySelector("[data-strip]"), filter.pid, { self: "tab-guarantee" });

  /* ── row actions ── */
  function onRowAction(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.closest("tr")?.dataset.id; const r = id && G.get(id); if (!r) return;
    if (b.dataset.act === "edit") openEditor(r);
    else if (b.dataset.act === "extend") requestExtension(r);
    else if (b.dataset.act === "case") activateTab("tab-jabo", { pid: r.pid, insurer: r.insurer, claim: r.claimNo, accident: r.accidentDate, focus: "manual" });
    else if (b.dataset.act === "recon") activateTab("tab-jabo", { pid: r.pid });
    else if (b.dataset.act === "del") removeRow(r);
  }
  // 연장 요청 — a call to the insurer: logs the entry and flips the status (the new end date is typed in the editor once granted).
  function requestExtension(r) {
    const entry = { at: Date.now(), actor: Session.user()?.staffId || null, kind: "전화", text: t("guarantee.logExtendText", { to: r.to || "—" }) };
    G.upsert({ ...r, status: "연장요청", log: [...(r.log || []), entry] });
    audit(TAG, t("guarantee.logExtend", { insurer: insurerLabel(r.insurer) }), r.pid);
    Haptic.save();
  }
  function removeRow(r) {
    const removed = G.remove(r.id); if (!removed) return;
    if (draft?.id === r.id) closeEditor();
    audit(TAG, t("guarantee.logDelete"), r.pid, { silent: true });
    Haptic.del();
    Toast.withUndo(t("guarantee.removedToast", { who: aliasOf(r.pid) }), () => { G.insert(removed.row, removed.index); audit(TAG, t("guarantee.logUndo"), r.pid, { silent: true }); }, TAG);
  }

  /* ── inline editor ── */
  const field = (label, inner, cls = "") => `<div class="field ${cls}"><label>${esc(label)}</label>${inner}</div>`;
  function openEditor(rec) {
    draft = JSON.parse(JSON.stringify(rec));
    const ed = host.querySelector("[data-editor]");
    ed.hidden = false;
    ed.innerHTML = `
      <h5>${esc(draft.id ? t("guarantee.editH") : t("guarantee.newH"))} <span class="p3-sub">${esc(draft.id ? aliasOf(draft.pid) : "")}</span></h5>
      <div class="form-grid p3-grid">
        ${field(t("patients.col.patient"), `<select data-e="pid">${pidOptions(draft.pid, { extra: [draft.pid] })}</select>`)}
        ${field(t("guarantee.col.insurer"), `<select data-e="insurer">${insurerOptions(draft.insurer)}</select>`)}
        ${field(t("guarantee.f.accident"), `<input type="date" data-e="accidentDate" value="${esc(draft.accidentDate)}">`)}
        ${field(t("guarantee.f.claimNo"), `<input type="text" data-e="claimNo" value="${esc(draft.claimNo)}" placeholder="SS-2026-77812">`)}
        ${field(t("guarantee.f.guaranteeNo"), `<input type="text" data-e="guaranteeNo" value="${esc(draft.guaranteeNo)}" placeholder="${esc(t("guarantee.f.guaranteeNoPh"))}">`)}
        ${field(t("guarantee.col.status"), `<select data-e="status">${STATUSES.map(s => `<option value="${s}"${s === draft.status ? " selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}</select>`)}
        ${field(t("guarantee.f.from"), `<input type="date" data-e="from" value="${esc(draft.from)}">`)}
        ${field(t("guarantee.f.to"), `<input type="date" data-e="to" value="${esc(draft.to)}">`)}
        <div class="field p3-span2"><label>${esc(t("guarantee.col.scope"))}</label>
          <div class="p3-checks">
            <label><input type="checkbox" data-scope="out"${draft.scope?.out ? " checked" : ""}> ${esc(t("guarantee.scope.out"))}</label>
            <label><input type="checkbox" data-scope="inp"${draft.scope?.inp ? " checked" : ""}> ${esc(t("guarantee.scope.inp"))}</label>
            <label><input type="checkbox" data-scope="herb"${draft.scope?.herb ? " checked" : ""}> ${esc(t("guarantee.scope.herb"))}</label>
          </div></div>
        ${field(t("guarantee.f.contactName"), `<input type="text" data-c="name" value="${esc(draft.contact?.name || "")}" placeholder="${esc(t("guarantee.f.contactNamePh"))}">`)}
        ${field(t("guarantee.f.contactPhone"), `<input type="tel" data-c="phone" value="${esc(draft.contact?.phone || "")}" placeholder="02-0000-0000">`)}
        ${field(t("guarantee.f.contactFax"), `<input type="tel" data-c="fax" value="${esc(draft.contact?.fax || "")}" placeholder="02-0000-0001">`)}
        ${field(t("common.thNote"), `<input type="text" data-e="note" value="${esc(draft.note || "")}" placeholder="${esc(t("guarantee.f.notePh"))}">`, "p3-span2")}
      </div>
      <div class="p3-log">
        <h6>${esc(t("guarantee.logH"))}</h6>
        <ul class="p3-log-list" data-log>${draft.log.length ? draft.log.map(l => `<li><span class="code">${esc(new Date(l.at).toISOString().slice(0, 16).replace("T", " "))}</span> <span class="pill">${esc(kindLabel(l.kind))}</span> <span>${esc(l.text)}</span> <span class="p3-sub">${esc(staffRef(l.actor))}</span></li>`).join("") : `<li class="p3-sub">${esc(t("guarantee.logEmpty"))}</li>`}</ul>
        <div class="p3-log-add">
          <select data-log-kind>${LOG_KINDS.map(k => `<option value="${k}">${esc(kindLabel(k))}</option>`).join("")}</select>
          <input type="text" data-log-text placeholder="${esc(t("guarantee.logPh"))}">
          <button type="button" class="btn secondary sm" data-log-add>${esc(t("guarantee.logAddBtn"))}</button>
        </div>
      </div>
      <div class="p3-editor-actions">
        <button type="button" class="btn" data-save>${esc(t("common.save"))}</button>
        <button type="button" class="btn secondary" data-cancel>${esc(t("common.cancel"))}</button>
        <span class="p3-sub">${esc(t("guarantee.editorHint"))}</span>
      </div>`;
    ed.querySelector("[data-log-add]").addEventListener("click", () => {
      const text = str(ed.querySelector("[data-log-text]").value); if (!text) return;
      readForm();
      draft.log.push({ at: Date.now(), actor: Session.user()?.staffId || null, kind: ed.querySelector("[data-log-kind]").value, text });
      openEditor(draft);
      ed.querySelector("[data-log-text]").focus();
    });
    ed.querySelector("[data-save]").addEventListener("click", save);
    ed.querySelector("[data-cancel]").addEventListener("click", () => { closeEditor(); Haptic.tap(); });
    ed.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const focusSel = draft.pid ? '[data-e="claimNo"]' : '[data-e="pid"]'; setTimeout(() => ed.querySelector(focusSel)?.focus({ preventScroll: true }), 40);
  }
  function readForm() {
    const ed = host.querySelector("[data-editor]");
    for (const el of ed.querySelectorAll("[data-e]")) draft[el.dataset.e] = str(el.value);
    draft.scope = { out: ed.querySelector('[data-scope="out"]').checked, inp: ed.querySelector('[data-scope="inp"]').checked, herb: ed.querySelector('[data-scope="herb"]').checked };
    draft.contact = { name: str(ed.querySelector('[data-c="name"]').value), phone: str(ed.querySelector('[data-c="phone"]').value), fax: str(ed.querySelector('[data-c="fax"]').value) };
    return draft;
  }
  function closeEditor() { draft = null; const ed = host.querySelector("[data-editor]"); ed.hidden = true; ed.innerHTML = ""; }
  function save() {
    readForm();
    if (!draft.pid) { Toast.show({ tag: TAG, html: esc(t("patients.errPid")) }); Haptic.warn(); return; }
    if (draft.from && draft.to && draft.to < draft.from) { Toast.show({ tag: TAG, html: esc(t("guarantee.errPeriod")) }); Haptic.warn(); return; }
    const isNew = !draft.id;
    try {
      Patients.ensure(draft.pid, { tags: ["자보"] }); if (draft.from) Patients.touch(draft.pid, draft.from);
      if (draft.insurer) Insurers.setLastUsed(draft.insurer);
      const saved = G.upsert(draft);
      audit(TAG, t(isNew ? "guarantee.logAdd" : "guarantee.logEdit", { insurer: insurerLabel(saved.insurer), status: statusLabel(saved.status) }), saved.pid);
      highlightId = saved.id;
      flowSt = flowState("flow.state.saved", G.list().length); paintFlowStatus(host, flowSt);
    } catch (err) { Toast.show({ tag: TAG, html: esc(err.message || String(err)) }); Haptic.warn(); return; }
    Haptic.save();
    closeEditor();
    renderList();
  }

  /* ── export — 지불보증 대장 XLSX (org header columns + one row per guarantee, aliases only) ── */
  function exportXLSX() {
    const rows = visible();
    if (!rows.length) { Toast.show({ tag: TAG, html: esc(t("guarantee.empty")) }); return; }
    const out = rows.map(r => headerRow([...orgHeader(),
      ["patients.col.patient", aliasOf(r.pid)], ["guarantee.col.insurer", insurerLabel(r.insurer)], ["guarantee.f.accident", r.accidentDate || ""],
      ["guarantee.f.claimNo", r.claimNo || ""], ["guarantee.f.guaranteeNo", r.guaranteeNo || ""], ["guarantee.col.scope", scopeText(r.scope)],
      ["guarantee.f.from", r.from || ""], ["guarantee.f.to", r.to || ""], ["guarantee.col.status", statusLabel(r.status)],
      ["guarantee.col.state", guaranteeState(r) ? t(guaranteeState(r) === "expired" ? "guarantee.badgeExpired" : "guarantee.chipSoon") : ""],
      ["guarantee.f.contactName", r.contact?.name || ""], ["guarantee.f.contactPhone", r.contact?.phone || ""], ["guarantee.f.contactFax", r.contact?.fax || ""],
      ["guarantee.col.log", (r.log || []).map(l => `${new Date(l.at).toISOString().slice(0, 10)} ${kindLabel(l.kind)}: ${l.text}`).join(" | ")],
      ["common.thNote", r.note || ""]
    ]));
    downloadXLSX(out, t("guarantee.fileName", { date: todayISO() }), t("guarantee.sheetName"));
    audit(TAG, t("guarantee.logExport", { n: rows.length }), null);
  }

  /* ── wiring ── */
  mount();
  // ① [샘플로 시연] — standalone: seeds this tracker's two guarantees (idempotent) and reports in ③.
  host.addEventListener("click", (e) => {
    if (!e.target.closest('[data-action="run-guarantee"]')) return;
    seed(); filter = { pid: "", status: "", q: "" }; mount();
    flowSt = flowState("flow.state.demo", G.list().length); paintFlowStatus(host, flowSt);
  });
  G.onChange(() => { renderList(); renderStrip(); });
  Patients.onChange(() => { const sel = host.querySelector("[data-f-pid]"); if (sel) sel.innerHTML = `<option value="">${esc(t("patients.allPatients"))}</option>` + pidOptions(filter.pid, { placeholder: false }); renderStrip(); renderList(); });
  onPanelCtx("tab-guarantee", {
    onPid: (pid) => { filter.pid = pid; mount(); },
    onCreate: (c) => { filter.pid = c.pid || filter.pid; mount(); openEditor({ ...blank(c.pid || ""), insurer: c.insurer || Insurers.lastUsed() || "", claimNo: c.claim || "", accidentDate: c.accident || "" }); },
    onId: (id) => { const r = G.get(id); if (!r) return; filter.pid = ""; filter.status = ""; highlightId = id; mount(); openEditor(r); }
  });
  onLangChange(() => { const d = draft ? readForm() : null; draft = null; mount(); if (d) openEditor(d); });
}

/* ── seed — the shared clinic's two 자보 patients (data/jabo-sample-claims.json: ****0142 삼성화재 SS-2026-77812 · sample
   accident 2026-08-03; ****0418 DB손해보험 accident 2026-08-06). The 0142 guarantee ran 2026-08-05 → 09-04, an extension was
   requested and the end pushed to five days from today so the "expiring" badge is live whatever day the demo runs. ── */
export function seed() {
  if (!Session.isUnlocked()) return;
  const have = new Set(G.list().map(r => r.id));
  const doctor = Session.user()?.staffId || null;
  const today = todayISO();
  const soon = addDays(today, 5);
  if (!have.has("seed-gu-0142")) {
    Patients.ensure("P-2026-0142", { tags: ["자보"] });
    G.upsert({
      id: "seed-gu-0142", pid: "P-2026-0142", insurer: "삼성", accidentDate: "2026-08-03", claimNo: "SS-2026-77812", guaranteeNo: "SG-26-08-0142",
      scope: { out: true, inp: false, herb: true }, from: "2026-08-05", to: soon, contact: { name: "보상팀 담당자", phone: "1588-5114", fax: "02-758-7000" },
      status: "연장요청", note: "약침 주 2회까지 보증 · 첩약은 10일분 한도",
      log: [
        { at: Date.parse("2026-08-05T09:40:00"), actor: doctor, kind: "전화", text: "지불보증 접수 — 외래 + 약침 포함, 09-04까지" },
        { at: Date.parse("2026-08-05T10:05:00"), actor: doctor, kind: "팩스", text: "지불보증서 수신 (SG-26-08-0142)" },
        { at: Date.parse(addDays(today, -1) + "T11:20:00"), actor: doctor, kind: "전화", text: `연장 요청 — 경추 통증 지속, ${soon}까지 요청 (담당자 검토 중)` }
      ],
      createdAt: Date.parse("2026-08-05T09:40:00")
    });
  }
  if (!have.has("seed-gu-0418")) {
    Patients.ensure("P-2026-0418", { tags: ["자보"] });
    G.upsert({
      id: "seed-gu-0418", pid: "P-2026-0418", insurer: "DB", accidentDate: "2026-08-06", claimNo: "DB-2026-30415", guaranteeNo: "DB-G-2608-0418",
      scope: { out: true, inp: false, herb: false }, from: "2026-08-08", to: "2026-08-31", contact: { name: "보상센터", phone: "1588-0100", fax: "" },
      status: "만료", note: "추나 횟수 한도 — 초과분 비급여 동의로 전환",
      log: [
        { at: Date.parse("2026-08-08T10:10:00"), actor: doctor, kind: "전화", text: "지불보증 접수 — 외래만, 08-31까지 · 추나 주 1회 한도" },
        { at: Date.parse("2026-09-01T09:00:00"), actor: doctor, kind: "메모", text: "보증 만료 — 연장 여부 환자와 상의" }
      ],
      createdAt: Date.parse("2026-08-08T10:10:00")
    });
  }
}
