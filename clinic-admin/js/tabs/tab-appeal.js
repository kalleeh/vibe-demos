/* clinic-admin — 청구 › 이의신청 관리 (#tab-appeal)
   A tracker keyed { batchId, payer, stmt, code, reasonKey } — one draft per adjusted 대조 line, created from 심사결과 대조 (자보)
   or 건보 대조 with "이의신청 준비" (activateTab("tab-appeal", { create })) or from the candidates list here.
     status  prep (준비중) → submitted (제출) → result (결과: accepted 인정 · partial 일부인정 · rejected 기각)
     fields  조정금액 · 사유 요약 · 근거 메모 · 첨부 체크리스트 (진료기록 사본 · 검사결과 · 소견서) · 통보일 · 기한 (= 통보일 + 90일,
             "확인 필요") · 제출일 · 결과일 · 결과금액
   Panel: list grouped by status with 기한 badges (D-day · overdue red), filters payer / month / status, inline edit drawer per
   row, XLSX "이의신청 대장" (watermarked), a printable "이의신청서 초안" (plain text, PoC mark, "양식은 심평원 서식 기준 — 확인 필요").
   Hand-offs: 대조로 보기 → tab-jabo | tab-nhis { stmt } · 상병 정비 → tab-kcd { stmt, batchId } · AI에게 근거 정리 요청 → tab-ai
   { prefill, pid, stmt }. ctx accepted: { create } · { appealId } · { filter: { payer, month, status } } · { from: { batchId } }.
   Data: claims-shared.js Appeals (appeals.list, encrypted, 1년). appealDeadlines() / appealStats() live there (홈 reads them
   from claims-shared.js directly); this module re-exports them and registers appealDeadlines as a core/calendar.js deadline
   source at load, so 홈's todo, the D-day list, the topbar chip and the .ics carry every open appeal's 기한.
   Domain: 국민건강보험법 §87 이의신청 — 90일 from knowing the decision (medium-high confidence, "확인 필요"); 자보 이의제기 goes
   to 심평원 자보심사센터 first (LOW confidence on its window — same 90-day placeholder). */
import { $, esc, won, fmtKRW, todayISO, setStatus, daysUntil, emptyHTML, flowStatus } from "../core/ui.js";
import { t, pick, getLang, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { downloadXLSX, headerRow, pocMark } from "../core/files.js";
import { registerDeadlineSource } from "../core/calendar.js";
import { Masters } from "../core/masters.js";
import { activateTab } from "../core/nav.js";
import { Org, Patients, Insurers } from "../core/entities.js";
import { Appeals, appealDeadlines, appealStats, appealStateOf, reconOf, appealFactsOf, nhisReasonLabel, payerLabel, reconTabOf, currentClaimsBatch, ensureSampleBatch, ensureNhisSampleBatch, reconcile, itemLinesOf, onClaimsChange } from "./claims-shared.js";

export { appealDeadlines, appealStats, appealStateOf };
registerDeadlineSource(appealDeadlines, { link: "tab-appeal", kind: "appeal" });
let seedFn = null;
export function seed(ctx) { return seedFn ? seedFn(ctx) : Promise.resolve(); }

const STATUS_ORDER = ["prep", "submitted", "result"];
const RESULT_KEYS = ["accepted", "partial", "rejected"];
const ATT = ["records", "tests", "opinion"];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function init(ctx) {
  const { DATA } = ctx;
  const host = $('[data-p3-slot="tab-appeal"]');
  if (!host) return;
  Masters.init(DATA);
  const JABO_REASONS = DATA?.jabo?.adjustment_reasons || [];
  const jaboReasonLabel = (key) => { const r = JABO_REASONS.find(x => x.key === key); return r ? pick(r, "label") : null; };
  const reasonLabelFor = (payer) => payer === "nhis" ? nhisReasonLabel : jaboReasonLabel;
  const procName = (code, name) => { const d = Masters.fee().rows.find(i => i.code === code); return d ? (pick(d, "name") || name) : name; };
  const insurerLabel = (v) => { const i = Insurers.list().find(x => x.value === v); return i ? pick(i, "label") : (v || ""); };
  // Reason text in the UI language: the notice's own wording wins, else the class label, else the stored text.
  const reasonOf = (a) => reasonLabelFor(a.payer)(a.reasonKey) || a.reasonText || a.reason || t("jabo.reasonUnknown");

  const filters = { payer: "all", month: "all", status: "all" };
  let openId = null, draftId = null, lastStatus = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#appeal-status"), kind, fn()); };

  /* ── deadline badge ── */
  const badge = (a) => {
    if (a.status === "result") return `<span class="pill ${a.result === "rejected" ? "err" : "ok"}">${esc(t("appeal.result." + (a.result || "accepted")))}</span>`;
    if (!a.dueDate) return `<span class="pill warn">${esc(t("appeal.dl.noNotice"))}</span>`;
    const d = daysUntil(a.dueDate);
    if (d < 0) return `<span class="pill err dday over">${esc(t("appeal.dl.overdue", { n: -d }))}</span>`;
    if (d === 0) return `<span class="pill err dday">${esc(t("appeal.dl.today"))}</span>`;
    return `<span class="pill ${d <= 14 ? "warn" : "info"} dday">${esc(t("appeal.dl.left", { n: d }))}</span>`;
  };

  /* ── filters ── */
  const fPayer = $("#appeal-f-payer"), fMonth = $("#appeal-f-month"), fStatus = $("#appeal-f-status");
  const fillFilters = () => {
    const months = [...new Set([...Appeals.list().map(a => a.month), ...["auto", "nhis"].map(p => currentClaimsBatch(p)?.meta?.month)].filter(Boolean))].sort().reverse();
    fPayer.innerHTML = [`<option value="all">${esc(t("appeal.f.allPayers"))}</option>`, ...["auto", "nhis"].map(p => `<option value="${p}">${esc(payerLabel(p))}</option>`)].join("");
    fMonth.innerHTML = [`<option value="all">${esc(t("appeal.f.allMonths"))}</option>`, ...months.map(m => `<option value="${esc(m)}">${esc(m)}</option>`)].join("");
    fStatus.innerHTML = [`<option value="all">${esc(t("appeal.f.allStatus"))}</option>`, ...STATUS_ORDER.map(s => `<option value="${s}">${esc(t("appeal.status." + s))}</option>`), `<option value="overdue">${esc(t("appeal.f.overdue"))}</option>`].join("");
    fPayer.value = filters.payer; fMonth.value = months.includes(filters.month) ? filters.month : "all"; fStatus.value = filters.status;
    filters.month = fMonth.value;
  };
  [fPayer, fMonth, fStatus].forEach(sel => sel.addEventListener("change", () => { filters.payer = fPayer.value; filters.month = fMonth.value; filters.status = fStatus.value; render(); }));
  const passes = (a) => (filters.payer === "all" || a.payer === filters.payer) && (filters.month === "all" || a.month === filters.month) &&
    (filters.status === "all" || (filters.status === "overdue" ? Appeals.isOverdue(a) : a.status === filters.status));

  /* ── summary strip ── */
  const renderSummary = (list) => {
    const el = $("#appeal-summary"); if (!el) return;
    const all = Appeals.list();
    const by = (s) => all.filter(a => a.status === s).length;
    const overdue = all.filter(Appeals.isOverdue).length;
    const cutSum = all.filter(Appeals.isOpen).reduce((s, a) => s + a.cutAmount, 0);
    const recovered = all.filter(a => a.status === "result").reduce((s, a) => s + (+a.resultAmount || 0), 0);
    el.innerHTML = t("appeal.summary", { n: all.length, shown: list.length, p: by("prep"), s: by("submitted"), r: by("result"), o: overdue, cut: won(cutSum), rec: won(recovered) });
    $("#appeal-export").disabled = !list.length;
  };

  /* ── candidates: adjusted lines of the current batch(es) without an appeal yet ── */
  const renderCandidates = () => {
    const el = $("#appeal-candidates"); if (!el) return;
    const payers = filters.payer === "all" ? ["auto", "nhis"] : [filters.payer];
    const rows = [];
    for (const p of payers) {
      const rec = reconOf(p); if (!rec) continue;
      if (filters.month !== "all" && rec.claims.meta?.month && rec.claims.meta.month !== filters.month) continue;
      for (const l of rec.res.lines) if (l.hasCut && !Appeals.findByLine({ batchId: rec.claims.id, stmt: l.stmt, code: l.code })) rows.push({ p, rec, l });
    }
    if (!rows.length) { el.innerHTML = emptyHTML(esc(t("appeal.cand.empty")), { small: true }); return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>${esc(t("appeal.th.payer"))}</th><th class="code">${esc(t("jabo.thStmt"))}</th><th>${esc(t("jabo.fPid"))}</th><th class="code">${esc(t("jabo.thCode"))}</th><th>${esc(t("jabo.thName"))}</th><th class="code">${esc(t("jabo.thCut"))}</th><th>${esc(t("jabo.thReason"))}</th><th>${esc(t("jabo.thActions"))}</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>
            <td><span class="pill info">${esc(payerLabel(r.p))}</span></td><td class="code">${esc(r.l.stmt)}</td><td>${r.l.pid ? esc(Patients.alias(r.l.pid)) : "—"}</td>
            <td class="code">${esc(r.l.code)}</td><td>${esc(procName(r.l.code, r.l.name))}</td>
            <td class="code" style="text-align:right; color:var(--accent)">−${fmtKRW(r.l.delta)}</td>
            <td style="font-size:11px; color:var(--ink-2)">${esc(reasonLabelFor(r.p)(r.l.reasonKey) || r.l.reasonText || t("jabo.reasonUnknown"))}</td>
            <td class="actions"><button type="button" class="row-act accent" data-cand="${i}">${esc(t("claims.actAppeal"))}</button></td>
          </tr>`).join("")}</tbody>
      </table>`;
    el.querySelectorAll("[data-cand]").forEach(b => b.addEventListener("click", () => {
      const r = rows[+b.dataset.cand]; if (!r) return;
      createFrom(appealFactsOf(r.l, r.rec.claims, { payer: r.p, insurer: r.p === "auto" ? Insurers.lastUsed() : "", procName, reasonLabel: reasonLabelFor(r.p) }));
    }));
  };

  /* ── list grouped by status + inline drawer ── */
  const drawer = (a) => {
    const chk = (k) => `<label class="appeal-chk"><input type="checkbox" data-f="att-${k}" ${a.attachments[k] ? "checked" : ""}> ${esc(t("appeal.att." + k))}</label>`;
    return `<tr class="appeal-edit" data-id="${esc(a.id)}"><td colspan="9">
      <div class="appeal-form">
        <div class="appeal-facts">
          <span><b>${esc(t("appeal.f.stmt"))}</b> <span class="code">${esc(a.stmt)}</span></span>
          <span><b>${esc(t("jabo.fPid"))}</b> ${a.pid ? esc(Patients.alias(a.pid)) : "—"}</span>
          <span><b>${esc(t("jabo.fDate"))}</b> <span class="code">${esc(a.date || "—")}</span></span>
          <span><b>${esc(t("appeal.f.dx"))}</b> <span class="code">${esc(a.dx.join(", ") || "—")}</span></span>
          <span><b>${esc(t("jabo.thName"))}</b> ${esc(a.code)} ${esc(procName(a.code, a.name))}</span>
          <span><b>${esc(t("appeal.f.amounts"))}</b> ${esc(t("appeal.f.amountsV", { c: fmtKRW(a.claimed), a: fmtKRW(a.approved), cut: fmtKRW(a.cutAmount) }))}</span>
          <span><b>${esc(t("jabo.thReason"))}</b> ${esc(reasonOf(a))}</span>
          ${a.payer === "auto" ? `<span><b>${esc(t("jabo.fInsurer"))}</b> ${esc(insurerLabel(a.insurer) || "—")}</span>` : ""}
        </div>
        <div class="form-grid appeal-grid">
          <div class="field"><label>${esc(t("appeal.f.noticeDate"))}</label><input type="date" data-f="noticeDate" value="${esc(a.noticeDate)}"></div>
          <div class="field"><label>${esc(t("appeal.f.dueDate", { n: Appeals.WINDOW_DAYS[a.payer] }))}</label><input type="date" data-f="dueDate" value="${esc(a.dueDate)}"></div>
          <div class="field"><label>${esc(t("appeal.f.cutAmount"))}</label><input type="number" min="0" data-f="cutAmount" value="${esc(a.cutAmount)}"></div>
          <div class="field"><label>${esc(t("appeal.f.status"))}</label>
            <div class="appeal-status-btns">${STATUS_ORDER.map(s => `<button type="button" class="ghost ${a.status === s ? "on" : ""}" data-status="${s}">${esc(t("appeal.status." + s))}</button>`).join("")}</div></div>
          <div class="field"><label>${esc(t("appeal.f.submittedDate"))}</label><input type="date" data-f="submittedDate" value="${esc(a.submittedDate)}"></div>
          <div class="field ${a.status === "result" ? "" : "dim"}"><label>${esc(t("appeal.f.result"))}</label>
            <select data-f="result">${[`<option value="">${esc(t("common.selectPlaceholder"))}</option>`, ...RESULT_KEYS.map(r => `<option value="${r}" ${a.result === r ? "selected" : ""}>${esc(t("appeal.result." + r))}</option>`)].join("")}</select></div>
          <div class="field ${a.status === "result" ? "" : "dim"}"><label>${esc(t("appeal.f.resultDate"))}</label><input type="date" data-f="resultDate" value="${esc(a.resultDate)}"></div>
          <div class="field ${a.status === "result" ? "" : "dim"}"><label>${esc(t("appeal.f.resultAmount"))}</label><input type="number" min="0" data-f="resultAmount" value="${esc(a.resultAmount)}"></div>
        </div>
        <div class="form-grid appeal-grid two">
          <div class="field"><label>${esc(t("appeal.f.summary"))}</label><textarea rows="3" data-f="summary" placeholder="${esc(t("appeal.f.summaryPh"))}">${esc(a.summary)}</textarea></div>
          <div class="field"><label>${esc(t("appeal.f.evidence"))}</label><textarea rows="3" data-f="evidence" placeholder="${esc(t("appeal.f.evidencePh"))}">${esc(a.evidence)}</textarea></div>
        </div>
        <div class="appeal-atts"><span class="label">${esc(t("appeal.f.attachments"))}</span>${ATT.map(chk).join("")}</div>
        <div class="appeal-actions">
          <button type="button" class="btn secondary sm" data-act="recon">${esc(t("appeal.act.recon"))}</button>
          <button type="button" class="btn secondary sm" data-act="kcd">${esc(t("jabo.actKcd"))}</button>
          <button type="button" class="btn secondary sm" data-act="ai">${esc(t("appeal.act.ai"))}</button>
          <button type="button" class="btn secondary sm" data-act="draft">${esc(t("appeal.act.draft"))}</button>
          <button type="button" class="ghost danger" data-act="remove">${esc(t("common.delete"))}</button>
          <span class="hint">${esc(t("appeal.autosave"))}</span>
        </div>
      </div></td></tr>`;
  };
  const rowHTML = (a) => `
    <tr class="appeal-row ${openId === a.id ? "open" : ""} ${Appeals.isOverdue(a) ? "overdue" : ""}" data-id="${esc(a.id)}">
      <td>${badge(a)}</td>
      <td><span class="pill info">${esc(payerLabel(a.payer))}</span></td>
      <td class="code">${esc(a.month || "—")}</td>
      <td class="code">${esc(a.stmt)}</td>
      <td>${a.pid ? esc(Patients.alias(a.pid)) : "—"}</td>
      <td>${esc(a.code)} <span class="muted">${esc(procName(a.code, a.name))}</span></td>
      <td class="code" style="text-align:right; color:var(--accent)">−${fmtKRW(a.cutAmount)}</td>
      <td style="font-size:11px; color:var(--ink-2)">${esc(reasonOf(a))}</td>
      <td class="code">${esc(a.dueDate || "—")}</td>
    </tr>`;
  const render = () => {
    fillFilters();
    const list = Appeals.list().filter(passes).sort((a, b) => (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) || ((a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1));
    renderSummary(list);
    renderCandidates();
    const el = $("#appeal-list"); if (!el) return;
    if (!list.length) { el.innerHTML = emptyHTML(esc(Appeals.list().length ? t("appeal.emptyFiltered") : t("appeal.empty")), { demoOnly: true }); renderDraft(); return; }
    el.innerHTML = STATUS_ORDER.filter(s => list.some(a => a.status === s)).map(s => {
      const rows = list.filter(a => a.status === s);
      return `<div class="appeal-group" data-status="${s}">
        <h5>${esc(t("appeal.status." + s))} <span class="count">${rows.length}</span>${s !== "result" && rows.some(Appeals.isOverdue) ? ` <span class="pill err">${esc(t("appeal.f.overdue"))} ${rows.filter(Appeals.isOverdue).length}</span>` : ""}</h5>
        <table>
          <thead><tr><th>${esc(t("appeal.th.due"))}</th><th>${esc(t("appeal.th.payer"))}</th><th class="code">${esc(t("jabo.thMonth"))}</th><th class="code">${esc(t("jabo.thStmt"))}</th><th>${esc(t("jabo.fPid"))}</th><th>${esc(t("jabo.thName"))}</th><th class="code">${esc(t("appeal.th.cut"))}</th><th>${esc(t("jabo.thReason"))}</th><th class="code">${esc(t("appeal.th.dueDate"))}</th></tr></thead>
          <tbody>${rows.map(a => rowHTML(a) + (openId === a.id ? drawer(a) : "")).join("")}</tbody>
        </table>
      </div>`;
    }).join("");
    el.querySelectorAll("tr.appeal-row").forEach(tr => tr.addEventListener("click", () => { openId = openId === tr.dataset.id ? null : tr.dataset.id; render(); }));
    const ed = el.querySelector("tr.appeal-edit");
    if (ed) wireDrawer(ed, Appeals.get(ed.dataset.id));
    renderDraft();
  };
  const wireDrawer = (ed, a) => {
    if (!a) return;
    const save = (patch) => { Appeals.update(a.id, patch); };
    ed.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("change", () => {
      const f = inp.dataset.f;
      if (f.startsWith("att-")) { save({ attachments: { ...Appeals.get(a.id).attachments, [f.slice(4)]: inp.checked } }); return; }
      if (f === "result") { save({ result: inp.value || null, status: inp.value ? "result" : Appeals.get(a.id).status }); return; }
      if (f === "noticeDate") { save({ noticeDate: inp.value }); return; } // dueDate recomputed by the data layer
      save({ [f]: inp.value });
    }));
    ed.querySelectorAll("[data-status]").forEach(b => b.addEventListener("click", () => {
      const s = b.dataset.status, cur = Appeals.get(a.id);
      const patch = { status: s };
      if (s === "submitted" && !cur.submittedDate) patch.submittedDate = todayISO();
      if (s === "result") { if (!cur.resultDate) patch.resultDate = todayISO(); if (!cur.result) patch.result = "accepted"; }
      if (s !== "result") patch.result = null;
      save(patch);
      ActivityLog.push("appeal", t("appeal.logStatus", { stmt: cur.stmt, st: t("appeal.status." + s) }), { pid: cur.pid });
    }));
    ed.querySelector('[data-act="recon"]').addEventListener("click", () => activateTab(reconTabOf(a.payer), { stmt: a.stmt }));
    ed.querySelector('[data-act="kcd"]').addEventListener("click", () => activateTab("tab-kcd", { stmt: a.stmt, batchId: a.batchId }));
    ed.querySelector('[data-act="ai"]').addEventListener("click", () => {
      const cur = Appeals.get(a.id);
      ActivityLog.push("appeal", t("appeal.logAi", { stmt: cur.stmt }), { pid: cur.pid });
      activateTab("tab-ai", { prefill: t("appeal.askPrefill", { stmt: cur.stmt, who: cur.pid ? Patients.alias(cur.pid) : "—", dx: cur.dx.join(", ") || "—", code: cur.code, name: procName(cur.code, cur.name), reason: reasonOf(cur), amt: won(cur.cutAmount), payer: payerLabel(cur.payer) }), pid: cur.pid, stmt: cur.stmt });
    });
    ed.querySelector('[data-act="draft"]').addEventListener("click", () => { draftId = a.id; renderDraft(); $("#appeal-draft-card")?.scrollIntoView({ block: "start", behavior: "smooth" }); });
    ed.querySelector('[data-act="remove"]').addEventListener("click", () => {
      const removed = Appeals.remove(a.id); openId = null; if (draftId === a.id) draftId = null;
      if (removed) ActivityLog.push("appeal", t("appeal.logRemoved", { stmt: removed.stmt }), { pid: removed.pid });
    });
    ed.addEventListener("click", (e) => e.stopPropagation()); // clicks inside the drawer must not toggle the row
  };

  /* ── 이의신청서 초안 (plain text · PoC) ── */
  const draftText = (a) => {
    const o = Org.get();
    const L = [];
    L.push(t("appeal.draft.title"), `[${pocMark()}]`, "");
    L.push(t("appeal.draft.to", { org: t(a.payer === "nhis" ? "appeal.draft.hiraNhis" : "appeal.draft.hiraAuto") }));
    L.push(t("appeal.draft.from", { org: o.name || "—", ykiho: o.ykiho || "—" }), "");
    L.push(t("appeal.draft.s1"));
    L.push("  " + t("appeal.draft.case1", { payer: payerLabel(a.payer), month: a.month || "—", stmt: a.stmt, who: a.pid ? Patients.alias(a.pid) : "—", date: a.date || "—" }));
    L.push("  " + t("appeal.draft.case2", { code: a.code, name: procName(a.code, a.name), c: won(a.claimed), a: won(a.approved), cut: won(a.cutAmount) }));
    L.push("  " + t("appeal.draft.case3", { reason: reasonOf(a), dx: a.dx.join(", ") || "—" }));
    if (a.payer === "auto" && a.insurer) L.push("  " + t("appeal.draft.caseIns", { ins: insurerLabel(a.insurer) }));
    L.push("  " + t("appeal.draft.case4", { notice: a.noticeDate || t("appeal.draft.na"), due: a.dueDate || t("appeal.draft.na"), n: Appeals.WINDOW_DAYS[a.payer] }), "");
    L.push(t("appeal.draft.s2"), "  " + t("appeal.draft.claim", { cut: won(a.cutAmount) }), "");
    L.push(t("appeal.draft.s3"), "  " + (a.summary || t("appeal.draft.na")), "");
    L.push(t("appeal.draft.s4"), "  " + (a.evidence || t("appeal.draft.na")), "");
    L.push(t("appeal.draft.s5"), "  " + ATT.map(k => `[${a.attachments[k] ? "x" : " "}] ${t("appeal.att." + k)}`).join("   "), "");
    L.push(t("appeal.draft.sign", { date: todayISO(), org: o.name || "—", rep: o.rep || "—" }), "");
    L.push(t("appeal.draft.formNote"));
    return L.join("\n");
  };
  const renderDraft = () => {
    const box = $("#appeal-draft"), btn = $("#appeal-draft-print"), title = $("#appeal-draft-for");
    if (!box) return;
    const a = draftId ? Appeals.get(draftId) : null;
    if (!a) { draftId = null; box.innerHTML = emptyHTML(esc(t("appeal.draft.empty")), { small: true }); btn.disabled = true; if (title) title.textContent = ""; return; }
    box.innerHTML = `<pre class="appeal-draft-text">${esc(draftText(a))}</pre>`;
    btn.disabled = false;
    if (title) title.textContent = t("appeal.draft.for", { stmt: a.stmt, who: a.pid ? Patients.alias(a.pid) : "—" });
  };
  $("#appeal-draft-print").addEventListener("click", () => {
    const a = draftId ? Appeals.get(draftId) : null; if (!a) return;
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) { window.print(); return; }
    const css = `body{font:13px/1.6 ui-monospace,Menlo,"Apple SD Gothic Neo","Noto Sans KR",monospace;color:#111;margin:32px;} pre{white-space:pre-wrap;word-break:keep-all;} .mark{margin-top:24px;padding-top:6px;border-top:1px solid #000;font-size:10px;letter-spacing:1.5px;text-align:center;}`;
    w.document.write(`<!doctype html><html lang="${esc(getLang())}"><head><meta charset="utf-8"><title>${esc(t("appeal.draft.docTitle"))}</title><style>${css}</style></head><body><pre>${esc(draftText(a))}</pre><p class="mark">${esc(pocMark())}</p></body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 250);
    ActivityLog.push("appeal", t("appeal.logDraft", { stmt: a.stmt }), { pid: a.pid });
  });

  /* ── XLSX 이의신청 대장 ── */
  $("#appeal-export").addEventListener("click", () => {
    const list = Appeals.list().filter(passes);
    if (!list.length) return;
    const rows = list.map(a => headerRow([
      ["appeal.col.payer", payerLabel(a.payer)], ["appeal.col.month", a.month], ["appeal.col.stmt", a.stmt], ["appeal.col.pid", a.pid], ["appeal.col.date", a.date],
      ["appeal.col.code", a.code], ["appeal.col.name", procName(a.code, a.name)], ["appeal.col.claimed", a.claimed], ["appeal.col.approved", a.approved], ["appeal.col.cut", a.cutAmount],
      ["appeal.col.reason", reasonOf(a)], ["appeal.col.insurer", a.payer === "auto" ? insurerLabel(a.insurer) : ""], ["appeal.col.status", t("appeal.status." + a.status)],
      ["appeal.col.noticeDate", a.noticeDate], ["appeal.col.dueDate", a.dueDate], ["appeal.col.submittedDate", a.submittedDate],
      ["appeal.col.result", a.result ? t("appeal.result." + a.result) : ""], ["appeal.col.resultDate", a.resultDate], ["appeal.col.resultAmount", a.resultAmount],
      ["appeal.col.summary", a.summary], ["appeal.col.evidence", a.evidence], ["appeal.col.attachments", ATT.filter(k => a.attachments[k]).map(k => t("appeal.att." + k)).join(", ")]
    ]));
    downloadXLSX(rows, t("appeal.exportFile", { date: todayISO() }), t("appeal.exportSheet")); // watermark + _PoC applied inside
    ActivityLog.push("appeal", t("appeal.logExport", { n: rows.length }), {});
  });

  /* ── create (from 대조 rows · candidates · ctx) ── */
  const createFrom = (facts) => {
    const a = Appeals.create(facts);
    if (!a) return null;
    if (!a.existed) ActivityLog.push("appeal", t("appeal.logCreated", { stmt: a.stmt, cut: won(a.cutAmount) }), { pid: a.pid });
    filters.payer = "all"; filters.month = "all"; filters.status = "all";
    openId = a.id; draftId = a.id;
    render();
    status(null, () => t(a.existed ? "appeal.statusExists" : "appeal.statusCreated", { stmt: a.stmt, cut: won(a.cutAmount), n: Appeals.WINDOW_DAYS[a.payer] }));
    setTimeout(() => $(`#appeal-list tr.appeal-row[data-id="${a.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    return a;
  };

  /* ── seed: three appeals for the shared clinic (overdue · submitted · resolved 일부인정) ── */
  seedFn = async () => {
    const [jabo, nhis] = await Promise.all([ensureSampleBatch(), ensureNhisSampleBatch()]);
    const line = (pair, stmt, code) => reconcile(itemLinesOf(pair.claims), pair.review.rows).lines.find(l => l.stmt === stmt && l.code === code);
    const mk = (pair, payer, stmt, code, extra) => {
      const l = line(pair, stmt, code); if (!l) return;
      if (Appeals.findByLine({ batchId: pair.claims.id, stmt, code })) return;
      const a = Appeals.create(appealFactsOf(l, pair.claims, { payer, insurer: payer === "auto" ? (Insurers.lastUsed() || "삼성") : "", procName, reasonLabel: reasonLabelFor(payer) }));
      Appeals.update(a.id, extra);
    };
    // 1 · 건보 · 0301 첩약 처방일수 — notice 100 days ago → 10 days OVERDUE, still 준비중 (the home todo lights up)
    mk(nhis, "nhis", "N2608-0005", "예시-16", { noticeDate: daysAgo(100), summary: t("appeal.seed.s1"), attachments: { records: true, tests: false, opinion: false } });
    // 2 · 자보 · 0418 추나 횟수 한도 — 제출 5 days ago
    mk(jabo, "auto", "M2608-0010", "예시-11", { noticeDate: daysAgo(20), status: "submitted", submittedDate: daysAgo(5), summary: t("appeal.seed.s2"), evidence: t("appeal.seed.e2"), attachments: { records: true, tests: false, opinion: true } });
    // 3 · 건보 · 0509 침 빈도 초과 — 일부인정 (half of the cut recovered)
    mk(nhis, "nhis", "N2608-0007", "예시-03", { noticeDate: daysAgo(60), status: "submitted", submittedDate: daysAgo(40), summary: t("appeal.seed.s3"), evidence: t("appeal.seed.e3"), attachments: { records: true, tests: false, opinion: false } });
    const third = Appeals.findByLine({ batchId: nhis.claims.id, stmt: "N2608-0007", code: "예시-03" });
    if (third && third.status !== "result") Appeals.update(third.id, { status: "result", result: "partial", resultDate: daysAgo(10), resultAmount: Math.round(third.cutAmount / 2) });
    render();
    status(null, () => flowStatus(t("flow.state.demo"), Appeals.list().length, t("appeal.statusSeeded")));
  };
  $('[data-action="run-appeal"]').addEventListener("click", () => { seedFn(); });

  /* ── ctx · events ── */
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-appeal") return;
    const c = p.ctx;
    if (!c) { render(); return; }
    if (c.filter) { filters.payer = c.filter.payer || "all"; filters.month = c.filter.month || "all"; filters.status = c.filter.status || "all"; }
    if (c.create) { createFrom(c.create); return; }
    if (c.appealId && Appeals.get(c.appealId)) { openId = c.appealId; draftId = c.appealId; filters.status = "all"; }
    render();
    if (c.appealId) setTimeout(() => $(`#appeal-list tr.appeal-row[data-id="${c.appealId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  });
  Appeals.onChange(render);
  onClaimsChange(render);
  EventBus.on("session:unlocked", render);
  onLangChange(() => { render(); if (lastStatus) setStatus($("#appeal-status"), lastStatus.kind, lastStatus.fn()); });
  render();
}
