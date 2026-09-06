/* clinic-admin — Tab 09 + ACCRED_ITEMS (shared constant — imported by tab0-today.js and shell.js)
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, $$, todayISO, Haptic, Toast, Share } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { activateTab } from "../core/nav.js";

/* ─────────────────────────────────────────────────────────
   Accreditation checklist data — Korean Hospital Accreditation
   (한국의료기관평가인증원, 한방병원 조사 항목 압축본 ~25항목)
   ───────────────────────────────────────────────────────── */
const ACCRED_ITEMS = [
  { title: "안전·질 (Safety)", items: [
    { id: "sa1", label: "환자 확인 절차 표준화 (이름·생년월일 2중 확인)", meta: "조사장: 외래·입원 모두" },
    { id: "sa2", label: "낙상 위험 평가 도구 사용 및 기록", meta: "입원환자 24시간 이내" },
    { id: "sa3", label: "응급 카트·약품 점검대장 매주 작성", meta: "주 1회 이상" }
  ]},
  { title: "환자권리·의사결정 (Patient Rights)", items: [
    { id: "pr1", label: "환자 권리·의무 게시 및 동의서 비치", meta: "외래·병동 게시" },
    { id: "pr2", label: "비급여 사전동의서 (자보·연말정산 관련 비급여 포함)", meta: "의료법 §45조의2", linkTab: "tab-bigeup" },
    { id: "pr3", label: "개인정보 처리방침 게시 (홈페이지 + 원내)", meta: "개인정보보호법" }
  ]},
  { title: "의무기록 (Medical Records)", items: [
    { id: "mr1", label: "진료기록부 보존기간 준수 (10년)", meta: "의료법 시행규칙 §15", linkTab: "tab-retention" },
    { id: "mr2", label: "처방전 사본 2년 보존", meta: "의료법 시행규칙 §15" },
    { id: "mr3", label: "기록부 폐기심의위원회 운영 규정", meta: "분기 1회 이상", linkTab: "tab-retention" },
    { id: "mr4", label: "KCD-8 진단코드 정확도 분기 점검", meta: "EDI 청구 정합성", linkTab: "tab-kcd" }
  ]},
  { title: "감염관리 (Infection Control)", items: [
    { id: "ic1", label: "침구·부항 멸균 SOP 및 감염관리 일지", meta: "한방 특화" },
    { id: "ic2", label: "의료폐기물 처리 (전용 용기·인계서)", meta: "폐기물관리법" },
    { id: "ic3", label: "직원 손위생 캠페인 (분기 교육)", meta: "WHO 5 Moments" }
  ]},
  { title: "시설·장비 (Facilities)", items: [
    { id: "fa1", label: "응급 산소·자동제세동기 점검대장", meta: "주 1회" },
    { id: "fa2", label: "한약 조제실 청결·온습도 기록", meta: "한약 GMP 준용" },
    { id: "fa3", label: "환기 시설 (외래·병동) 정기 점검", meta: "분기 1회" }
  ]},
  { title: "인사·교육 (HR)", items: [
    { id: "hr1", label: "한의사·간호사 면허 신고 및 보수교육 이수 관리", meta: "개인별 3년 주기 (의료법 §25)", linkTab: "tab-license" },
    { id: "hr2", label: "신규 입사자 오리엔테이션 기록 (감염관리·환자안전)", meta: "입사 후 7일 이내" },
    { id: "hr3", label: "직원 폭언·폭력 예방 교육 (의료기관 내)", meta: "연 1회 이상" }
  ]},
  { title: "행정·청구 (Admin)", items: [
    { id: "ad1", label: "자보 EDI 청구·삭감 분석 월별 정리", meta: "삭감률 모니터링", linkTab: "tab-jabo" },
    { id: "ad2", label: "HIRA 비급여 반기보고 마감 준수 (3월·9월)", meta: "의료법 §45조의2", linkTab: "tab-bigeup" },
    { id: "ad3", label: "국세청 의료비 일괄제출 사전검증 (1월)", meta: "PCC 누락분 보정", linkTab: "tab-yearend" },
    { id: "ad4", label: "외부감사 또는 내부 행정점검 분기 1회", meta: "행정 자체 점검" }
  ]}
];

/* ─────────────────────────────────────────────────────────
   Tab 9 — 인증평가 체크리스트
   ───────────────────────────────────────────────────────── */
export function initTab9() {
  const cats = ACCRED_ITEMS;
  const checked = Store.get("accred.checked", {});

  const render = () => {
    const allItems = cats.map(c => c.items).flat();
    const doneTotal = allItems.filter(it => checked[it.id]).length;
    const pct = allItems.length ? Math.round((doneTotal / allItems.length) * 100) : 0;
    $("#accred-summary").innerHTML = `<strong>${doneTotal}</strong> / ${allItems.length} 항목 완료 — ${pct}%`;
    $("#accred-bar").style.width = pct + "%";

    $("#accred-cats").innerHTML = cats.map(cat => {
      const cdone = cat.items.filter(it => checked[it.id]).length;
      const cpct = Math.round((cdone / cat.items.length) * 100);
      return `
        <div class="accred-cat">
          <div class="accred-cat-head">
            <div class="ch">${cat.title.replace(/\((.+?)\)/, '<em>$1</em>')}</div>
            <div class="pct"><strong>${cdone}</strong> / ${cat.items.length} · ${cpct}%</div>
          </div>
          ${cat.items.map(it => `
            <div class="accred-item ${checked[it.id] ? "done" : ""}" data-id="${it.id}">
              <span class="check">${checked[it.id] ? "✓" : ""}</span>
              <div class="body">${it.label}<span class="item-meta">${it.meta || ""}</span></div>
              ${it.linkTab ? `<a class="accred-link" href="#" data-link="${it.linkTab}">바로가기 →</a>` : ""}
            </div>`).join("")}
        </div>`;
    }).join("");

    $$(".accred-item").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.classList.contains("accred-link")) return;
        const id = el.dataset.id;
        checked[id] = !checked[id];
        // Pass a copy: Store.set re-emits the value to the store:accred.checked
        // handler below, which clears `checked` before copying the payload in —
        // with the same reference that wiped every earlier check.
        Store.set("accred.checked", { ...checked });
        ActivityLog.push("accred", `인증평가 항목 ${checked[id] ? "체크" : "해제"}`, { id });
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

  $("#accred-print").addEventListener("click", () => {
    ActivityLog.push("accred", "인증평가 PDF 출력", {});
    window.print();
  });
  $("#accred-share")?.addEventListener("click", async () => {
    const allItems = cats.map(c => c.items).flat();
    const doneTotal = allItems.filter(it => checked[it.id]).length;
    const pct = allItems.length ? Math.round((doneTotal / allItems.length) * 100) : 0;
    const lines = cats.map(cat => {
      const cdone = cat.items.filter(it => checked[it.id]).length;
      return `• ${cat.title} — ${cdone} / ${cat.items.length}`;
    });
    const text = `[한방병원 인증평가 진행률]\n진행: ${doneTotal} / ${allItems.length} (${pct}%)\n\n${lines.join("\n")}\n\n— ${todayISO()} 기준`;
    await Share.send({ title: "인증평가 자체점검 진행률", text });
    ActivityLog.push("accred", "인증평가 진행률 공유", {});
  });
  // No confirm — the cleared checks come back from the undo toast for 6 s.
  $("#accred-reset").addEventListener("click", () => {
    const snap = { ...checked };
    const n = Object.values(snap).filter(Boolean).length;
    if (!n) { Toast.show({ tag: "accred", html: "체크된 항목이 없습니다." }); return; }
    Store.remove("accred.checked");
    for (const k in checked) delete checked[k];
    ActivityLog.push("accred", `인증평가 초기화 — 체크 ${n}개 해제`, { silent: true });
    Haptic.del();
    render();
    Toast.withUndo(`초기화됨 · 인증평가 체크 ${n}개 해제`, () => {
      Store.set("accred.checked", { ...snap }); // store handler copies it into `checked` + renders
      ActivityLog.push("accred", `초기화 취소 — 체크 ${n}개 복원`, { silent: true });
    }, "accred");
  });

  EventBus.on("store:accred.checked", (v) => {
    Object.keys(checked).forEach(k => delete checked[k]);
    Object.assign(checked, v || {});
    render();
  });

  render();
}

export { ACCRED_ITEMS };
