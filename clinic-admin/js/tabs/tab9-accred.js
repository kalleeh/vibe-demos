/* clinic-admin — Tab 09 · 인증 자체점검 + ACCRED_ITEMS (shared constant — imported by tab0-today.js and shell.js)
   Sibling import: retentionStats from tab5-retention.js (the 파기 대장 count is mr3's disposal-review evidence); tab5 never
   imports tab9, so the direction is one-way. */
import { $, $$, esc, todayISO, daysUntil, relTime, Haptic, Toast, Share, setStatus, flowStatus } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { pocMark } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Staff, Tariff } from "../core/entities.js";
import { retentionStats } from "./tab5-retention.js";

/* ─────────────────────────────────────────────────────────
   자체점검 예시 — 의료기관평가인증원 한방병원 인증기준의 영역을 따라
   압축한 EXAMPLE items; the real 조사 기준 is the 인증원's current manual.
   Shape { title, items: [{ id, label, meta, linkTab? }] } is shared with
   tab0-today.js and shell.js — keep it stable. `*_en` fields are the English
   view (accredText() picks them); the Korean fields stay the source of truth.
   Items listed in DERIVED below are judged automatically from app state (Staff · Tariff · the last 보존/KCD run)
   and render a status badge instead of a checkbox; the others stay manual.
   ───────────────────────────────────────────────────────── */
const ACCRED_ITEMS = [
  { title: "안전·질 (Safety)", title_en: "Safety & quality (안전·질)", items: [
    { id: "sa1", label: "환자 확인 절차 표준화 (이름·생년월일 2중 확인)", label_en: "Standardised patient identification (double-check name + date of birth)", meta: "조사장: 외래·입원 모두", meta_en: "Surveyed in outpatient and inpatient areas" },
    { id: "sa2", label: "낙상 위험 평가 도구 사용 및 기록", label_en: "Fall-risk assessment tool used and documented", meta: "입원환자 24시간 이내", meta_en: "Inpatients within 24 hours" },
    { id: "sa3", label: "응급 카트·약품 점검대장 매주 작성", label_en: "Weekly emergency cart and drug checklist", meta: "주 1회 이상", meta_en: "At least weekly" }
  ]},
  { title: "환자권리·의사결정 (Patient Rights)", title_en: "Patient rights & decisions (환자권리)", items: [
    { id: "pr1", label: "환자 권리·의무 게시 및 동의서 비치", label_en: "Patient rights and duties posted; consent forms available", meta: "외래·병동 게시", meta_en: "Posted in outpatient and ward areas" },
    // 비급여 사전설명 duty: 의료법 §45 (고지) + 시행규칙 §42조의2 (사전설명) — §45조의2 is the 보고 duty. Confidence: high.
    { id: "pr2", label: "비급여 진료 전 사전설명 및 설명 확인 기록", label_en: "Advance explanation of non-covered items (비급여) and confirmation record", meta: "의료법 §45 · 시행규칙 §42조의2", meta_en: "Medical Service Act §45 · Enforcement Rule §42-2 (의료법 §45 · 시행규칙 §42조의2)", linkTab: "tab-bigeup" },
    { id: "pr3", label: "개인정보 처리방침 게시 (홈페이지 + 원내)", label_en: "Privacy policy posted (website + on site)", meta: "개인정보보호법", meta_en: "Personal Information Protection Act (개인정보보호법)" }
  ]},
  { title: "의무기록 (Medical Records)", title_en: "Medical records (의무기록)", items: [
    { id: "mr1", label: "진료기록부 보존기간 준수 (10년)", label_en: "Medical-record retention period observed (10 years)", meta: "의료법 시행규칙 §15", meta_en: "Medical Service Act Enforcement Rule §15 (의료법 시행규칙 §15)", linkTab: "tab-retention" },
    { id: "mr2", label: "처방전 사본 2년 보존", label_en: "Prescription copies kept 2 years", meta: "의료법 시행규칙 §15", meta_en: "Medical Service Act Enforcement Rule §15 (의료법 시행규칙 §15)" },
    { id: "mr3", label: "기록부 폐기 심의 절차 운영 규정", label_en: "Written procedure for record-disposal review", meta: "내부 절차 (법정 의무 아님)", meta_en: "Internal procedure (not a statutory duty)", linkTab: "tab-retention" },
    { id: "mr4", label: "상병코드(KCD) 정확도 분기 점검", label_en: "Quarterly diagnosis-code (KCD) accuracy check", meta: "EDI 청구 정합성 · 최신 개정판 대조", meta_en: "EDI claim consistency · compared against the current revision", linkTab: "tab-kcd" }
  ]},
  { title: "감염관리 (Infection Control)", title_en: "Infection control (감염관리)", items: [
    { id: "ic1", label: "침구·부항 멸균 SOP 및 감염관리 일지", label_en: "Sterilisation SOP for needles and cupping; infection-control log", meta: "한방 특화", meta_en: "Korean-medicine specific" },
    { id: "ic2", label: "의료폐기물 처리 (전용 용기·인계서)", label_en: "Medical-waste handling (dedicated containers, transfer records)", meta: "폐기물관리법", meta_en: "Wastes Control Act (폐기물관리법)" },
    { id: "ic3", label: "직원 손위생 캠페인 (분기 교육)", label_en: "Staff hand-hygiene campaign (quarterly training)", meta: "WHO 5 Moments", meta_en: "WHO 5 Moments" }
  ]},
  { title: "시설·장비 (Facilities)", title_en: "Facilities & equipment (시설·장비)", items: [
    { id: "fa1", label: "응급 산소·자동제세동기 점검대장", label_en: "Emergency oxygen and AED checklist", meta: "주 1회", meta_en: "Weekly" },
    { id: "fa2", label: "한약 조제실 청결·온습도 기록", label_en: "Herbal dispensary cleanliness and temperature/humidity log", meta: "한약 GMP 준용", meta_en: "Herbal GMP applied by analogy" },
    { id: "fa3", label: "환기 시설 (외래·병동) 정기 점검", label_en: "Regular ventilation checks (outpatient, wards)", meta: "분기 1회", meta_en: "Quarterly" }
  ]},
  { title: "인사·교육 (HR)", title_en: "Staff & training (인사·교육)", items: [
    { id: "hr1", label: "한의사·간호사 면허 신고 및 보수교육 이수 관리", label_en: "Licence renewal reports and CME tracked for KM doctors and nurses", meta: "개인별 3년 주기 (의료법 §25)", meta_en: "3-year cycle per person (Medical Service Act §25)", linkTab: "tab-license" },
    { id: "hr2", label: "신규 입사자 오리엔테이션 기록 (감염관리·환자안전)", label_en: "New-hire orientation records (infection control, patient safety)", meta: "입사 후 7일 이내", meta_en: "Within 7 days of joining" },
    { id: "hr3", label: "직원 폭언·폭력 예방 교육 (의료기관 내)", label_en: "Staff training on preventing verbal abuse and violence", meta: "연 1회 이상", meta_en: "At least yearly" }
  ]}
];

// Not 인증 criteria — the admin tools in this app that feed the checklist. Rendered
// outside the checklist proper, never counted or checkable.
const RELATED_TOOLS = [
  { label: "자보 EDI 청구·삭감 분석", label_en: "Auto-insurance EDI claims and cut analysis", meta: "삭감률 모니터링", meta_en: "Cut-rate monitoring", linkTab: "tab-jabo" },
  { label: "비급여 보고 준비 (3월·9월분 → 4월·10월 보고)", label_en: "Non-covered report prep (March/September visits → April/October)", meta: "의료법 §45조의2", meta_en: "Medical Service Act §45-2 (의료법 §45조의2)", linkTab: "tab-bigeup" },
  { label: "연말정산 의료비 자료 사전점검 (1월)", label_en: "Year-end medical-expense data pre-check (January)", meta: "간소화 자료 누락분", meta_en: "Entries missing from simplified filing data", linkTab: "tab-yearend" },
  { label: "의무기록 보존기간 점검", label_en: "Medical-record retention check", meta: "의료법 시행규칙 §15", meta_en: "Medical Service Act Enforcement Rule §15 (의료법 시행규칙 §15)", linkTab: "tab-retention" }
];
// Localised text of an ACCRED_ITEMS / RELATED_TOOLS field ("title" | "label" | "meta").
const accredText = (obj, field) => pick(obj, field);

/* ── Derived (자동 판정) items — each returns { level: "ok"|"warn"|"bad", reason: [key, vars], ctx? } ──
   hr1  Staff: every 신고-duty row has a 신고일 and none is due within 90 days.
   mr1  retention.lastAudit: run exists and 0 rows past their retention period.
   mr3  retention.disposals (tab5 retentionStats): the 파기 대장 is the disposal-review evidence — ok when at least one
        disposal is recorded; warn when the last audit found expired rows but nothing was disposed (or rows are misclassified);
        bad when no audit has run at all.
   mr4  kcd.lastSummary: run within the quarter (90 d) and nothing 미수록/검토.
   pr2  Tariff: ≥1 priced item AND an 적용일 (the price list the 사전설명 is based on). */
const addYears = (iso, n) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return ""; d.setFullYear(d.getFullYear() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DERIVED = {
  hr1() {
    const duty = Staff.list().filter(s => Staff.hasDuty(s.job));
    if (!duty.length) return { level: "bad", reason: ["accred.auto.hr1.none"] };
    const unreported = duty.filter(s => !s.reported);
    const imminent = duty.filter(s => { const exp = s.expiry || addYears(s.reported || s.acquired, 3); const d = daysUntil(exp); return d != null && d <= 90; });
    if (unreported.length) return { level: "warn", reason: ["accred.auto.hr1.unreported", { n: unreported.length, total: duty.length }], ctx: { staffId: unreported[0].id } };
    if (imminent.length) return { level: "warn", reason: ["accred.auto.hr1.imminent", { n: imminent.length }], ctx: { staffId: imminent[0].id } };
    return { level: "ok", reason: ["accred.auto.hr1.ok", { n: duty.length }] };
  },
  mr1() {
    const a = Store.get("retention.lastAudit");
    if (!a) return { level: "bad", reason: ["accred.auto.noAudit"] };
    if (a.over > 0) return { level: "bad", reason: ["accred.auto.mr1.over", { n: a.over, t: relTime(a.at) }] };
    return { level: "ok", reason: ["accred.auto.mr1.ok", { t: relTime(a.at) }] };
  },
  mr3() {
    const a = Store.get("retention.lastAudit");
    const rs = retentionStats();
    if (!a && !rs.disposals) return { level: "bad", reason: ["accred.auto.noAudit"] };
    if (rs.disposals > 0) return { level: "ok", reason: ["accred.auto.mr3.ledger", { n: rs.disposals, t: relTime(rs.lastDisposalAt) }] };
    if (a.bad > 0) return { level: "warn", reason: ["accred.auto.mr3.bad", { n: a.bad }] };
    if (a.over > 0) return { level: "warn", reason: ["accred.auto.mr3.noLedger", { n: a.over, t: relTime(a.at) }] };
    return { level: "ok", reason: ["accred.auto.mr3.ok", { t: relTime(a.at), n: a.total }] };
  },
  mr4() {
    const s = Store.get("kcd.lastSummary");
    if (!s) return { level: "bad", reason: ["accred.auto.mr4.none"] };
    const stale = s.at && (Date.now() - s.at) > 90 * 86400000;
    if (stale) return { level: "warn", reason: ["accred.auto.mr4.stale", { t: relTime(s.at) }] };
    if ((s.missing || 0) > 0 || (s.review || 0) > 0) return { level: "warn", reason: ["accred.auto.mr4.open", { m: s.missing || 0, r: s.review || 0 }] };
    return { level: "ok", reason: ["accred.auto.mr4.ok", { t: relTime(s.at) }] };
  },
  pr2() {
    const n = Object.keys(Tariff.all()).length, d = Tariff.effectiveDate();
    if (!n) return { level: "bad", reason: ["accred.auto.pr2.none"] };
    if (!d) return { level: "warn", reason: ["accred.auto.pr2.noDate", { n }] };
    return { level: "ok", reason: ["accred.auto.pr2.ok", { n, d }] };
  }
};
const isDerived = (id) => !!DERIVED[id];
const derive = (id) => DERIVED[id] ? DERIVED[id]() : null;
const ALL_ITEMS = ACCRED_ITEMS.flatMap(c => c.items);

// Progress shared with 00 오늘: manual checks + derived items that currently pass. Never counts a derived id
// from `checked` (seed-all may have ticked one — harmless, ignored).
function accredProgress(checked = Store.get("accred.checked", {}) || {}) {
  const derived = ALL_ITEMS.filter(it => isDerived(it.id)).map(it => ({ id: it.id, ...derive(it.id) }));
  const manualDone = ALL_ITEMS.filter(it => !isDerived(it.id) && checked[it.id]).length;
  const autoDone = derived.filter(d => d.level === "ok").length;
  return { done: manualDone + autoDone, total: ALL_ITEMS.length, derived, failing: derived.filter(d => d.level !== "ok") };
}

/* ─────────────────────────────────────────────────────────
   Tab 9 — 인증 자체점검 예시
   ───────────────────────────────────────────────────────── */
let api = null;
export function seed() { api?.seed(); }

export function init() {
  const cats = ACCRED_ITEMS;
  const checked = Store.get("accred.checked", {});
  const allItems = ALL_ITEMS;
  const fillCounts = () => $$("[data-accred-count]").forEach(el => el.textContent = String(allItems.length));
  fillCounts();
  const isDone = (it, d) => isDerived(it.id) ? d?.level === "ok" : !!checked[it.id];
  const GLYPH = { ok: "✓", warn: "△", bad: "✗" };
  let demoAt = null; // set by ① [샘플로 시연] → the ③ status names the demo until the next reload

  const render = () => {
    const derived = Object.fromEntries(allItems.filter(it => isDerived(it.id)).map(it => [it.id, derive(it.id)]));
    const doneTotal = allItems.filter(it => isDone(it, derived[it.id])).length;
    const pct = allItems.length ? Math.round((doneTotal / allItems.length) * 100) : 0;
    $("#accred-summary").innerHTML = t("accred.summary", { d: doneTotal, n: allItems.length, p: pct });
    $("#accred-bar").style.width = pct + "%";
    // ③ — status line ({state} · {n}건 · {when}) + the auto-judged items with their reasons (checkable items stay in ②).
    const autoList = allItems.filter(it => isDerived(it.id)).map(it => ({ it, d: derived[it.id] }));
    const autoOk = autoList.filter(x => x.d.level === "ok").length;
    setStatus($("#accred-status"), autoOk === autoList.length ? null : "warn", flowStatus(t(demoAt ? "flow.state.demo" : "accred.autoState"), doneTotal, t("accred.autoSummary", { ok: autoOk, n: autoList.length, p: pct })));
    const al = $("#accred-auto-list");
    if (al) al.innerHTML = autoList.map(({ it, d }) => `<div class="accred-auto-row ${d.level}" data-auto="${esc(it.id)}"><span class="check">${GLYPH[d.level]}</span><div class="body">${esc(accredText(it, "label"))}<span class="item-meta">${esc(t(d.reason[0], d.reason[1]))}</span></div>${it.linkTab ? `<a class="accred-link" href="#" data-link="${esc(it.linkTab)}"${d.ctx ? ` data-ctx='${esc(JSON.stringify(d.ctx))}'` : ""}>${esc(t("accred.goto"))}</a>` : ""}</div>`).join("");

    $("#accred-cats").innerHTML = cats.map(cat => {
      const cdone = cat.items.filter(it => isDone(it, derived[it.id])).length;
      const cpct = Math.round((cdone / cat.items.length) * 100);
      return `
        <div class="accred-cat">
          <div class="accred-cat-head">
            <div class="ch">${esc(accredText(cat, "title")).replace(/\((.+?)\)/, '<em>$1</em>')}</div>
            <div class="pct"><strong>${cdone}</strong> / ${cat.items.length} · ${cpct}%</div>
          </div>
          ${cat.items.map(it => {
            const d = derived[it.id];
            const done = isDone(it, d);
            const ctxAttr = d?.ctx ? ` data-ctx='${esc(JSON.stringify(d.ctx))}'` : "";
            const badge = d ? `<span class="accred-auto ${d.level}" title="${esc(t("accred.autoTitle"))}"><span class="glyph">${GLYPH[d.level]}</span> ${esc(t("accred.autoLabel"))} · ${esc(t(d.reason[0], d.reason[1]))}</span>` : "";
            return `
            <div class="accred-item ${done ? "done" : ""} ${d ? "derived" : ""}" data-id="${esc(it.id)}">
              <span class="check">${d ? GLYPH[d.level] : (done ? "✓" : "")}</span>
              <div class="body">${esc(accredText(it, "label"))}<span class="item-meta">${esc(accredText(it, "meta") || "")}</span>${badge}</div>
              ${it.linkTab ? `<a class="accred-link" href="#" data-link="${esc(it.linkTab)}"${ctxAttr}>${esc(t("accred.goto"))}</a>` : ""}
            </div>`;
          }).join("")}
        </div>`;
    }).join("") + `
        <div class="accred-cat accred-tools">
          <div class="accred-cat-head">
            <div class="ch">${t("accred.toolsH")}</div>
            <div class="pct">${esc(t("accred.toolsExcluded"))}</div>
          </div>
          ${RELATED_TOOLS.map(tool => `
            <div class="accred-item tool">
              <span class="check">→</span>
              <div class="body">${esc(accredText(tool, "label"))}<span class="item-meta">${esc(accredText(tool, "meta"))}</span></div>
              <a class="accred-link" href="#" data-link="${esc(tool.linkTab)}">${esc(t("accred.goto"))}</a>
            </div>`).join("")}
        </div>`;

    $$(".accred-item:not(.tool):not(.derived)").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.classList.contains("accred-link")) return;
        const id = el.dataset.id;
        checked[id] = !checked[id];
        // Pass a copy: Store.set re-emits the value to the store:accred.checked
        // handler below, which clears `checked` before copying the payload in —
        // with the same reference that wiped every earlier check.
        Store.set("accred.checked", { ...checked });
        ActivityLog.push("accred", t("accred.logToggle", { what: t(checked[id] ? "accred.checked" : "accred.unchecked") }), { id });
        render();
      });
    });
    $$(".accred-link").forEach(a => {
      a.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        let c = null;
        try { c = a.dataset.ctx ? JSON.parse(a.dataset.ctx) : null; } catch {}
        activateTab(a.dataset.link, c || undefined);
      });
    });
  };

  // Print footer — PoC watermark, visible only in print (styles-reporting.css).
  const renderFooter = () => {
    const foot = $("#accred-print-footer");
    if (foot) foot.textContent = t("accred.printFooter", { mark: pocMark(), date: todayISO(), n: allItems.length });
  };
  renderFooter();

  $("#accred-print").addEventListener("click", () => {
    ActivityLog.push("accred", t("accred.logPrint"), {});
    window.print();
  });
  $("#accred-share")?.addEventListener("click", async () => {
    const { done: doneTotal } = accredProgress(checked);
    const pct = allItems.length ? Math.round((doneTotal / allItems.length) * 100) : 0;
    const lines = cats.map(cat => {
      const cdone = cat.items.filter(it => isDone(it, isDerived(it.id) ? derive(it.id) : null)).length;
      return t("accred.shareLine", { title: accredText(cat, "title"), d: cdone, n: cat.items.length });
    });
    const text = t("accred.shareText", { n: allItems.length, d: doneTotal, p: pct, lines: lines.join("\n"), date: todayISO(), mark: pocMark() });
    await Share.send({ title: t("accred.shareTitle"), text });
    ActivityLog.push("accred", t("accred.logShare"), {});
  });
  // No confirm — the cleared checks come back from the undo toast for 6 s.
  $("#accred-reset").addEventListener("click", () => {
    const snap = { ...checked };
    const n = Object.values(snap).filter(Boolean).length;
    if (!n) { Toast.show({ tag: "accred", html: esc(t("accred.noneChecked")) }); return; }
    Store.remove("accred.checked");
    for (const k in checked) delete checked[k];
    ActivityLog.push("accred", t("accred.logReset", { n }), { silent: true });
    Haptic.del();
    render();
    Toast.withUndo(t("accred.resetToast", { n }), () => {
      Store.set("accred.checked", { ...snap }); // store handler copies it into `checked` + renders
      ActivityLog.push("accred", t("accred.logUndo", { n }), { silent: true });
    }, "accred");
  });

  EventBus.on("store:accred.checked", (v) => {
    Object.keys(checked).forEach(k => delete checked[k]);
    Object.assign(checked, v || {});
    render();
  });
  // Derived inputs changed → re-judge.
  ["store:retention.lastAudit", "store:retention.disposals", "store:kcd.lastSummary", "session:unlocked"].forEach(ev => EventBus.on(ev, () => render()));
  Staff.onChange(() => render());
  Tariff.onChange(() => render());

  // Deep link from 00 / other tabs → { itemId }: scroll to the item and highlight it briefly.
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-accred" || !p.ctx?.itemId) return;
    const el = $(`.accred-item[data-id="${p.ctx.itemId}"]`);
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("hl");
      setTimeout(() => el.classList.remove("hl"), 2400);
    }, 60);
  });

  render();
  onLangChange(() => { fillCounts(); renderFooter(); render(); });

  // seed(): tick a coherent set of MANUAL items (safety/rights/infection basics a running 한방병원 has) — derived
  // ones judge themselves from Staff / Tariff / the last audits, which the other tabs' seed() fill.
  api = { seed: () => {
    for (const id of ["sa1", "sa3", "pr1", "pr3", "mr2", "ic1", "ic2", "fa1", "hr2"]) checked[id] = true;
    Store.set("accred.checked", { ...checked });
    render();
  } };
  // ① [샘플로 시연] — standalone: ticks the same nine manual items the seed does and names the demo in ③.
  $('[data-action="run-accred"]')?.addEventListener("click", () => { demoAt = Date.now(); api.seed(); ActivityLog.push("accred", t("accred.logDemo"), { sample: true }); });
}

export { ACCRED_ITEMS, accredText, accredProgress, isDerived };
