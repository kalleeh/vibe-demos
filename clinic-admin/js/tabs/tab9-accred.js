/* clinic-admin — Tab 09 · 인증 자체점검 + ACCRED_ITEMS (shared constant — imported by tab0-today.js and shell.js) */
import { $, $$, esc, todayISO, Haptic, Toast, Share } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { activateTab } from "../core/nav.js";
import { pocMark } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   자체점검 예시 — 의료기관평가인증원 한방병원 인증기준의 영역을 따라
   압축한 EXAMPLE items; the real 조사 기준 is the 인증원's current manual.
   Shape { title, items: [{ id, label, meta, linkTab? }] } is shared with
   tab0-today.js and shell.js — keep it stable. `*_en` fields are the English
   view (accredText() picks them); the Korean fields stay the source of truth.
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

/* ─────────────────────────────────────────────────────────
   Tab 9 — 인증 자체점검 예시
   ───────────────────────────────────────────────────────── */
export function initTab9() {
  const cats = ACCRED_ITEMS;
  const checked = Store.get("accred.checked", {});
  const allItems = cats.map(c => c.items).flat();
  const fillCounts = () => $$("[data-accred-count]").forEach(el => el.textContent = String(allItems.length));
  fillCounts();

  const render = () => {
    const doneTotal = allItems.filter(it => checked[it.id]).length;
    const pct = allItems.length ? Math.round((doneTotal / allItems.length) * 100) : 0;
    $("#accred-summary").innerHTML = t("accred.summary", { d: doneTotal, n: allItems.length, p: pct });
    $("#accred-bar").style.width = pct + "%";

    $("#accred-cats").innerHTML = cats.map(cat => {
      const cdone = cat.items.filter(it => checked[it.id]).length;
      const cpct = Math.round((cdone / cat.items.length) * 100);
      return `
        <div class="accred-cat">
          <div class="accred-cat-head">
            <div class="ch">${esc(accredText(cat, "title")).replace(/\((.+?)\)/, '<em>$1</em>')}</div>
            <div class="pct"><strong>${cdone}</strong> / ${cat.items.length} · ${cpct}%</div>
          </div>
          ${cat.items.map(it => `
            <div class="accred-item ${checked[it.id] ? "done" : ""}" data-id="${esc(it.id)}">
              <span class="check">${checked[it.id] ? "✓" : ""}</span>
              <div class="body">${esc(accredText(it, "label"))}<span class="item-meta">${esc(accredText(it, "meta") || "")}</span></div>
              ${it.linkTab ? `<a class="accred-link" href="#" data-link="${esc(it.linkTab)}">${esc(t("accred.goto"))}</a>` : ""}
            </div>`).join("")}
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

    $$(".accred-item:not(.tool)").forEach(el => {
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
        activateTab(a.dataset.link);
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
    const doneTotal = allItems.filter(it => checked[it.id]).length;
    const pct = allItems.length ? Math.round((doneTotal / allItems.length) * 100) : 0;
    const lines = cats.map(cat => {
      const cdone = cat.items.filter(it => checked[it.id]).length;
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

  render();
  onLangChange(() => { fillCounts(); renderFooter(); render(); });
}

export { ACCRED_ITEMS, accredText };
