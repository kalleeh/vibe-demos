/* clinic-admin — 환자 › 비급여 설명·동의 — pre-treatment explanation + consent records for non-covered (비급여) items.

   DOMAIN (confidence in brackets). Before a 비급여 item is provided the institution must explain the item and its price
   to the patient — 의료법 §45 (posting) and 의료법 시행규칙 §42조의2 (사전 설명) [medium — the duty is certain, the article
   numbering is "확인 필요"]. Most hospitals keep a signed 동의서 on paper or as a scan; the everyday 한방 cases are 첩약,
   약침 and the 추나 sessions beyond the covered count [high]. Prices come from the clinic's own 비급여 단가표 (조직 ›
   비급여 보고, the Tariff entity) — nothing here invents a price.

   Record (Store key consent.list — encrypted, 5 years "확인 필요", registered via lifecycle.registerRows):
     { id, pid, at, items: [{ code (Tariff code), name, price, qty }], explainedBy (staffId), method: 구두+서면|서면|전자,
       signed: boolean, note, createdAt, updatedAt }
   Item names are snapshotted at save time (a tariff rename later must not rewrite a signed record).
   ctx handled: { pid } · { pid, create: true } · { id } · { pid, create: true, items: [codes] } (prefilled item lines). */
import { Toast, Haptic, todayISO, won } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { downloadXLSX, headerRow, orgHeader } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Org, Patients, Staff, Tariff } from "../core/entities.js";
import { Session } from "../security/session.js";
import { registerRows } from "../security/lifecycle.js";
import { tariffRows, tariffPrice } from "./claims-shared.js";
import { $, $$, esc, KEYS, collection, str, num, audit, renderTable, chipRow, onPanelCtx, renderPatientStrip, pidOptions, staffOptions, staffRef, aliasOf, dash, openPrint, introHTML } from "./patients-shared.js";

const METHODS = ["구두+서면", "서면", "전자"];
const TAG = "consent";
const C = collection(KEYS.consent);

const atMs = (r) => { const d = Date.parse((r?.at || "") + "T00:00:00"); return Number.isFinite(d) ? d : (r?.createdAt || 0); };
registerRows([{
  id: "consent.list", key: KEYS.consent, match: (k) => k === KEYS.consent, label: "비급여 사전 설명·동의 기록",
  detail: "환자번호(가명)·일자·항목(비급여 코드·명칭·단가·수량)·설명자(직원 id)·방식·서명 여부 — 환자 이름·서명 이미지 없음",
  purpose: "비급여 사전 설명 의무 이행 기록 · 동의서 초안 출력",
  basis: "의료법 §45 · 의료법 시행규칙 §42조의2 (비급여 사전 설명) — 조문·보존기간 확인 필요 · PoC 문구",
  encrypted: true, retention: "5년 (확인 필요)", days: 5 * 365,
  purge: (v, cutoff) => (Array.isArray(v) ? v.filter(r => atMs(r) >= cutoff) : v)
}]);

export const list = () => C.list();
export const get = (id) => C.get(id);
export const total = (r) => (r?.items || []).reduce((a, it) => a + num(it.price) * (num(it.qty) || 1), 0);

const methodLabel = (m) => t("consent.method." + m);
const blank = (pid = "") => ({ id: "", pid, at: todayISO(), items: [], explainedBy: "", method: "구두+서면", signed: false, note: "" });

export function init({ DATA } = {}) {
  const host = $('#tab-consent [data-p3-slot="tab-consent"]');
  if (!host) return;
  const nameOf = (code) => { const it = (DATA?.bigeup?.items || []).find(x => x.code === code); return it ? pick(it, "name") : ""; };
  const tariffItems = () => tariffRows(nameOf);
  let filter = { pid: "", signed: "", q: "" };
  let draft = null, highlightId = null;

  const mount = () => {
    const hasTariff = tariffItems().length > 0;
    host.innerHTML = `${introHTML("consent")}
      <div class="card p3-card">
        <h4><span class="step">01</span> <span>${esc(t("consent.listH"))}</span> <span class="p3-count" data-count></span></h4>
        ${hasTariff ? "" : `<div class="status-line warn p3-tariff-empty" data-tariff-empty><span class="dot"></span><span>${esc(t("consent.tariffEmpty"))} <button type="button" class="link" data-go-tariff>${esc(t("consent.tariffEmptyGo"))} →</button></span></div>`}
        <div class="p3-filter">
          <select class="p3-pid" data-f-pid aria-label="${esc(t("patients.filterPatient"))}"><option value="">${esc(t("patients.allPatients"))}</option>${pidOptions(filter.pid, { placeholder: false })}</select>
          <div class="search-filters p3-chips" data-chips>${chipRow(["", "signed", "unsigned"], filter.signed, v => v === "" ? t("patients.all") : v === "signed" ? t("consent.chipSigned") : t("consent.chipUnsigned"))}</div>
          <input type="search" class="p3-search" data-f-q value="${esc(filter.q)}" placeholder="${esc(t("consent.searchPh"))}" aria-label="${esc(t("consent.searchPh"))}">
          <span class="spacer"></span>
          <button type="button" class="btn" data-new>${esc(t("consent.newBtn"))}</button>
        </div>
        <div class="p3-strip" data-strip hidden></div>
        <div class="p3-editor" data-editor hidden></div>
        <div class="result p3-result" data-list></div>
        <div class="result-toolbar">
          <div class="summary" data-summary></div>
          <div class="actions">
            <button type="button" class="btn secondary" data-export>${esc(t("consent.exportBtn"))} <span class="arrow">↓</span></button>
          </div>
        </div>
        <p class="caveat">${t("consent.caveat")}</p>
      </div>`;
    host.querySelector("[data-go-tariff]")?.addEventListener("click", () => activateTab("tab-bigeup"));
    host.querySelector("[data-f-pid]").addEventListener("change", (e) => { filter.pid = e.target.value; renderList(); renderStrip(); });
    host.querySelector("[data-chips]").addEventListener("click", (e) => { const b = e.target.closest("[data-chip]"); if (!b) return; filter.signed = b.dataset.chip; $$("[data-chip]", host).forEach(x => x.classList.toggle("active", x === b)); renderList(); });
    host.querySelector("[data-f-q]").addEventListener("input", (e) => { filter.q = e.target.value; renderList(); });
    host.querySelector("[data-new]").addEventListener("click", () => openEditor(blank(filter.pid)));
    host.querySelector("[data-export]").addEventListener("click", exportXLSX);
    host.querySelector("[data-list]").addEventListener("click", onRowAction);
    renderStrip(); renderList();
    if (draft) openEditor(draft);
  };

  const visible = () => {
    const q = filter.q.trim().toLowerCase();
    return C.list().filter(r => (!filter.pid || r.pid === filter.pid)
      && (!filter.signed || (filter.signed === "signed" ? !!r.signed : !r.signed))
      && (!q || [r.note, ...(r.items || []).flatMap(it => [it.code, it.name])].some(v => String(v || "").toLowerCase().includes(q))))
      .sort((a, b) => (b.at || "").localeCompare(a.at || "") || (b.updatedAt || 0) - (a.updatedAt || 0));
  };
  const itemsHTML = (r) => (r.items || []).length
    ? `<ul class="p3-items">${r.items.map(it => `<li><span class="code">${esc(it.code)}</span> ${esc(it.name || nameOf(it.code) || "—")} <span class="p3-sub">${esc(won(num(it.price)))} × ${esc(String(num(it.qty) || 1))}</span></li>`).join("")}</ul>`
    : "—";
  const renderList = () => {
    const rows = visible(), all = C.list();
    const unsigned = all.filter(r => !r.signed).length;
    host.querySelector("[data-count]").textContent = t("patients.nRows", { n: all.length });
    host.querySelector("[data-summary]").textContent = t("consent.summary", { n: rows.length, unsigned, sum: won(rows.reduce((a, r) => a + total(r), 0)) });
    renderTable(host.querySelector("[data-list]"), {
      highlightId,
      empty: esc(Session.isUnlocked() ? t("consent.empty") : t("patients.locked")),
      columns: [
        { key: "at", label: t("consent.col.at"), cls: "code" }, { key: "pid", label: t("patients.col.patient") }, { key: "items", label: t("consent.col.items") },
        { key: "total", label: t("consent.col.total"), cls: "code" }, { key: "by", label: t("consent.col.explainedBy") }, { key: "method", label: t("consent.col.method") }, { key: "signed", label: t("consent.col.signed") }
      ],
      rows: rows.map(r => ({
        id: r.id, cls: r.signed ? "" : "warn",
        cells: {
          at: esc(dash(r.at)), pid: `<strong>${esc(aliasOf(r.pid))}</strong>`, items: itemsHTML(r) + (r.note ? `<div class="p3-sub">${esc(r.note)}</div>` : ""),
          total: esc(won(total(r))), by: esc(staffRef(r.explainedBy)), method: esc(methodLabel(r.method)),
          signed: r.signed ? `<span class="pill ok">${esc(t("consent.signedYes"))}</span>` : `<span class="pill warn">${esc(t("consent.signedNo"))}</span>`
        },
        actions: `
          <button type="button" class="row-act" data-act="edit" title="${esc(t("common.edit"))}">✎</button>
          <button type="button" class="row-act" data-act="print">${esc(t("consent.printBtn"))}</button>
          <button type="button" class="row-act accent" data-act="jabo">${esc(t("consent.toJabo"))}</button>
          <button type="button" class="row-act" data-act="del" title="${esc(t("common.delete"))}">×</button>`
      }))
    });
    highlightId = null;
  };
  const renderStrip = () => renderPatientStrip(host.querySelector("[data-strip]"), filter.pid, { self: "tab-consent" });

  function onRowAction(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.closest("tr")?.dataset.id; const r = id && C.get(id); if (!r) return;
    if (b.dataset.act === "edit") openEditor(r);
    else if (b.dataset.act === "print") printDraft(r);
    else if (b.dataset.act === "jabo") activateTab("tab-jabo", { pid: r.pid, items: (r.items || []).map(it => it.code) });
    else if (b.dataset.act === "del") {
      const removed = C.remove(r.id); if (!removed) return;
      if (draft?.id === r.id) closeEditor();
      audit(TAG, t("consent.logDelete"), r.pid, { silent: true });
      Haptic.del();
      Toast.withUndo(t("consent.removedToast", { who: aliasOf(r.pid) }), () => { C.insert(removed.row, removed.index); audit(TAG, t("consent.logUndo"), r.pid, { silent: true }); }, TAG);
    }
  }

  /* ── inline editor ── */
  const field = (label, inner, cls = "") => `<div class="field ${cls}"><label>${esc(label)}</label>${inner}</div>`;
  function openEditor(rec) {
    draft = JSON.parse(JSON.stringify(rec));
    const ed = host.querySelector("[data-editor]");
    const items = tariffItems();
    ed.hidden = false;
    ed.innerHTML = `
      <h5>${esc(draft.id ? t("consent.editH") : t("consent.newH"))} <span class="p3-sub">${esc(draft.id ? aliasOf(draft.pid) : "")}</span></h5>
      <div class="form-grid p3-grid">
        ${field(t("patients.col.patient"), `<select data-e="pid">${pidOptions(draft.pid, { extra: [draft.pid] })}</select>`)}
        ${field(t("consent.col.at"), `<input type="date" data-e="at" value="${esc(draft.at)}">`)}
        ${field(t("consent.col.explainedBy"), `<select data-e="explainedBy">${staffOptions(draft.explainedBy)}</select>`)}
        ${field(t("consent.col.method"), `<select data-e="method">${METHODS.map(m => `<option value="${m}"${m === draft.method ? " selected" : ""}>${esc(methodLabel(m))}</option>`).join("")}</select>`)}
        <div class="field"><label>${esc(t("consent.col.signed"))}</label><div class="p3-checks"><label><input type="checkbox" data-signed${draft.signed ? " checked" : ""}> ${esc(t("consent.signedLabel"))}</label></div></div>
        ${field(t("common.thNote"), `<input type="text" data-e="note" value="${esc(draft.note || "")}" placeholder="${esc(t("consent.notePh"))}">`)}
      </div>
      <div class="p3-log">
        <h6>${esc(t("consent.itemsH"))} <span class="p3-sub" data-total>${esc(won(total(draft)))}</span></h6>
        <ul class="p3-log-list p3-item-lines" data-items>${draft.items.length ? draft.items.map((it, i) => `<li><span class="code">${esc(it.code)}</span> <span>${esc(it.name || nameOf(it.code) || "—")}</span> <span class="p3-sub">${esc(won(num(it.price)))} × <input type="number" min="1" max="99" value="${esc(String(num(it.qty) || 1))}" data-qty="${i}" aria-label="${esc(t("consent.col.qty"))}"></span> <button type="button" class="row-act" data-item-del="${i}" title="${esc(t("common.delete"))}">×</button></li>`).join("") : `<li class="p3-sub">${esc(t("consent.itemsEmpty"))}</li>`}</ul>
        <div class="p3-log-add">
          <select data-item-code ${items.length ? "" : "disabled"}><option value="">${esc(items.length ? t("consent.pickItem") : t("consent.tariffEmptyShort"))}</option>${items.map(it => `<option value="${esc(it.code)}">${esc(it.code)} · ${esc(it.name || "—")} · ${esc(won(it.price))}</option>`).join("")}</select>
          <input type="number" min="1" max="99" value="1" data-item-qty aria-label="${esc(t("consent.col.qty"))}">
          <button type="button" class="btn secondary sm" data-item-add ${items.length ? "" : "disabled"}>${esc(t("consent.addItemBtn"))}</button>
          ${items.length ? "" : `<button type="button" class="link" data-go-tariff>${esc(t("consent.tariffEmptyGo"))} →</button>`}
        </div>
      </div>
      <div class="p3-editor-actions">
        <button type="button" class="btn" data-save>${esc(t("common.save"))}</button>
        <button type="button" class="btn secondary" data-cancel>${esc(t("common.cancel"))}</button>
        <span class="p3-sub">${esc(t("consent.editorHint"))}</span>
      </div>`;
    ed.querySelector("[data-go-tariff]")?.addEventListener("click", () => activateTab("tab-bigeup"));
    ed.querySelector("[data-item-add]").addEventListener("click", () => {
      const code = ed.querySelector("[data-item-code]").value; if (!code) return;
      const def = items.find(it => it.code === code); if (!def) return;
      readForm();
      const qty = Math.max(1, num(ed.querySelector("[data-item-qty]").value) || 1);
      const ex = draft.items.find(it => it.code === code);
      if (ex) ex.qty = (num(ex.qty) || 1) + qty; else draft.items.push({ code, name: def.name || nameOf(code), price: def.price, qty });
      openEditor(draft);
      ed.querySelector("[data-item-code]").focus();
    });
    ed.querySelector("[data-items]").addEventListener("click", (e) => { const b = e.target.closest("[data-item-del]"); if (!b) return; readForm(); draft.items.splice(+b.dataset.itemDel, 1); openEditor(draft); });
    ed.querySelector("[data-items]").addEventListener("input", (e) => { const q = e.target.closest("[data-qty]"); if (!q) return; readForm(); ed.querySelector("[data-total]").textContent = won(total(draft)); });
    ed.querySelector("[data-save]").addEventListener("click", save);
    ed.querySelector("[data-cancel]").addEventListener("click", () => { closeEditor(); Haptic.tap(); });
    ed.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const focusSel = draft.pid ? "[data-item-code]" : '[data-e="pid"]'; setTimeout(() => ed.querySelector(focusSel)?.focus({ preventScroll: true }), 40);
  }
  function readForm() {
    const ed = host.querySelector("[data-editor]");
    for (const el of ed.querySelectorAll("[data-e]")) draft[el.dataset.e] = str(el.value);
    draft.signed = !!ed.querySelector("[data-signed]")?.checked;
    ed.querySelectorAll("[data-qty]").forEach(q => { const it = draft.items[+q.dataset.qty]; if (it) it.qty = Math.max(1, num(q.value) || 1); });
    return draft;
  }
  function closeEditor() { draft = null; const ed = host.querySelector("[data-editor]"); ed.hidden = true; ed.innerHTML = ""; }
  function save() {
    readForm();
    if (!draft.pid) { Toast.show({ tag: TAG, html: esc(t("patients.errPid")) }); Haptic.warn(); return; }
    if (!draft.items.length) { Toast.show({ tag: TAG, html: esc(t("consent.errItems")) }); Haptic.warn(); return; }
    if (!draft.explainedBy) { Toast.show({ tag: TAG, html: esc(t("consent.errExplainer")) }); Haptic.warn(); return; }
    const isNew = !draft.id;
    try {
      Patients.ensure(draft.pid, { tags: ["비급여"] }); if (draft.at) Patients.touch(draft.pid, draft.at);
      const saved = C.upsert(draft);
      audit(TAG, t(isNew ? "consent.logAdd" : "consent.logEdit", { n: saved.items.length, sum: won(total(saved)), signed: saved.signed ? t("consent.signedYes") : t("consent.signedNo") }), saved.pid);
      highlightId = saved.id;
    } catch (err) { Toast.show({ tag: TAG, html: esc(err.message || String(err)) }); Haptic.warn(); return; }
    Haptic.save();
    closeEditor();
    renderList();
  }

  /* ── exports ── */
  function exportXLSX() {
    const rows = visible();
    if (!rows.length) { Toast.show({ tag: TAG, html: esc(t("consent.empty")) }); return; }
    const out = rows.flatMap(r => (r.items.length ? r.items : [{ code: "", name: "", price: 0, qty: 0 }]).map(it => headerRow([...orgHeader(),
      ["consent.col.at", r.at || ""], ["patients.col.patient", aliasOf(r.pid)], ["consent.col.code", it.code], ["consent.col.item", it.name || nameOf(it.code)],
      ["consent.col.price", num(it.price)], ["consent.col.qty", num(it.qty) || 1], ["consent.col.amount", num(it.price) * (num(it.qty) || 1)],
      ["consent.col.explainedBy", staffRef(r.explainedBy)], ["consent.col.method", methodLabel(r.method)], ["consent.col.signed", r.signed ? "Y" : "N"], ["common.thNote", r.note || ""]
    ])));
    downloadXLSX(out, t("consent.fileName", { date: todayISO() }), t("consent.sheetName"));
    audit(TAG, t("consent.logExport", { n: rows.length }), null);
  }
  // Printable 동의서 초안 — org, patient alias, items + prices, date, signature lines. The real form is the hospital's own 양식.
  function printDraft(r) {
    const o = Org.get();
    const body = `
      <h5>${esc(t("consent.printTitle"))}</h5>
      <p>${esc(o.name || "—")}${o.rep ? ` · ${esc(t("org.col.rep"))} ${esc(o.rep)}` : ""} · ${esc(t("consent.col.at"))} ${esc(r.at || "—")}</p>
      <p>${esc(t("patients.col.patient"))}: <strong>${esc(aliasOf(r.pid))}</strong> <span class="muted">${esc(t("consent.printAliasNote"))}</span></p>
      <p class="muted">${esc(t("consent.printIntro"))}</p>
      <table><thead><tr><th>${esc(t("consent.col.code"))}</th><th>${esc(t("consent.col.item"))}</th><th>${esc(t("consent.col.price"))}</th><th>${esc(t("consent.col.qty"))}</th><th>${esc(t("consent.col.amount"))}</th></tr></thead>
      <tbody>${(r.items || []).map(it => `<tr><td class="code">${esc(it.code)}</td><td>${esc(it.name || nameOf(it.code) || "—")}</td><td class="code">${esc(won(num(it.price)))}</td><td class="code">${esc(String(num(it.qty) || 1))}</td><td class="code">${esc(won(num(it.price) * (num(it.qty) || 1)))}</td></tr>`).join("")}
      <tr><td colspan="4"><strong>${esc(t("consent.col.total"))}</strong></td><td class="code"><strong>${esc(won(total(r)))}</strong></td></tr></tbody></table>
      <p class="muted">${esc(t("consent.printExplained", { who: staffRef(r.explainedBy), method: methodLabel(r.method) }))}</p>
      <div class="sign"><div>${esc(t("consent.printSignPatient"))}</div><div>${esc(t("consent.printSignStaff"))}</div></div>
      <p class="muted">${esc(t("consent.printFoot"))}</p>`;
    openPrint(t("consent.printTitle"), body);
    audit(TAG, t("consent.logPrint"), r.pid);
  }

  /* ── wiring ── */
  mount();
  C.onChange(() => { renderList(); renderStrip(); });
  Tariff.onChange(() => { const d = draft ? readForm() : null; draft = null; mount(); if (d) openEditor(d); }); // the empty-state notice + the item picker follow the tariff
  Patients.onChange(() => { const sel = host.querySelector("[data-f-pid]"); if (sel) sel.innerHTML = `<option value="">${esc(t("patients.allPatients"))}</option>` + pidOptions(filter.pid, { placeholder: false }); renderStrip(); renderList(); });
  Staff.onChange(() => renderList());
  onPanelCtx("tab-consent", {
    onPid: (pid) => { filter.pid = pid; mount(); },
    onCreate: (c) => {
      filter.pid = c.pid || filter.pid; mount();
      const items = (Array.isArray(c.items) ? c.items : []).map(code => ({ code, name: nameOf(code), price: tariffPrice(code) || 0, qty: 1 })).filter(it => it.price > 0);
      openEditor({ ...blank(c.pid || ""), items });
    },
    onId: (id) => { const r = C.get(id); if (!r) return; filter.pid = ""; filter.signed = ""; highlightId = id; mount(); openEditor(r); }
  });
  onLangChange(() => { const d = draft ? readForm() : null; draft = null; mount(); if (d) openEditor(d); });
}

/* ── seed — three consents priced from the seeded 비급여 tariff (data/bigeup.json codes; Tab4's seed runs first):
   ****0301 첩약 14일분 (예시-07) · ****0142 약침 (예시-03 팔강 약침) · ****0418 추나 한도 초과분 → 비급여 운동요법 (예시-24). ── */
export function seed() {
  if (!Session.isUnlocked()) return;
  const have = new Set(C.list().map(r => r.id));
  const staff = Staff.list();
  const byName = (name) => staff.find(s => s.name === name && s.job === "한의사")?.id || staff.find(s => s.job === "한의사")?.id || Session.user()?.staffId || null;
  const yoon = byName("윤지훈"), park = byName("박서연");
  const priced = (code, qty, fallbackName) => ({ code, name: fallbackName, price: tariffPrice(code) || 0, qty });
  const rows = [
    { id: "seed-cs-0301", pid: "P-2026-0301", at: "2026-08-06", items: [priced("예시-07", 14, "첩약 — 시범사업 대상 외 (1일분)")], explainedBy: park, method: "구두+서면", signed: true, note: "슬관절 첩약 14일분 · 시범사업 대상 외" },
    { id: "seed-cs-0142", pid: "P-2026-0142", at: "2026-08-04", items: [priced("예시-03", 2, "약침술 — 팔강 약침")], explainedBy: yoon, method: "구두+서면", signed: true, note: "자보 보증 범위 밖 약침 — 본인 부담 설명" },
    { id: "seed-cs-0418", pid: "P-2026-0418", at: "2026-09-01", items: [priced("예시-24", 4, "한방 운동요법 (1:1)")], explainedBy: park, method: "서면", signed: false, note: "추나 주 1회 한도 초과분 → 비급여 전환 · 서명 대기" }
  ];
  for (const r of rows) if (!have.has(r.id)) { Patients.ensure(r.pid, { tags: ["비급여"] }); Patients.touch(r.pid, r.at); C.upsert({ ...r, createdAt: Date.parse(r.at + "T11:00:00") }); }
}
