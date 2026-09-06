/* clinic-admin — Tab 04 · 비급여 보고 준비표 */
import { $, $$, esc, fmtKRW, todayISO, setStatus, debounce } from "../core/ui.js";
import { Store, ActivityLog, bindPersist } from "../core/store.js";
import { downloadXLSX } from "../core/files.js";
import { BIGEUP_WINDOWS, nextOccurrence } from "../core/calendar.js";

/* ─────────────────────────────────────────────────────────
   Tab 4 — 비급여 진료비용 보고 준비 (의료법 §45조의2)
   The hospital enters, per 예시 item, its 단가 (최저·최고·중간) and
   실시빈도 (참고월 건수). 심평원 derives the published distribution
   from what every institution submits — min/max/mid here are only a
   local sanity check. Items are 예시; real codes come from the 심평원
   비급여 보고 표준코드 목록.
   ───────────────────────────────────────────────────────── */
export function initTab4(ctx) {
  const { DATA } = ctx;
  const tbody = $("#bg-tbody");
  const items = DATA.bigeup.items;
  const N = items.length;
  // Row count is computed, never hard-coded in copy.
  $$("[data-bg-count]").forEach(el => el.textContent = String(N));

  // Deadline copy — next submission window from the shared calendar.
  const now = new Date();
  const nextWin = BIGEUP_WINDOWS
    .map(w => ({ ...w, date: nextOccurrence(w.month, null, now) }))
    .sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const winEl = $("#bg-window");
  if (winEl) winEl.textContent = `다음 보고: ${nextWin.refMonth}월 진료분 → ${nextWin.date.slice(0, 7).replace("-", "년 ")}월 보고 기간 (확인 필요)`;

  // Restore last-saved entries if any (keyed by 예시 code)
  const savedTariff = Store.get("bigeup.tariff", {});
  const state = items.map(it => ({
    ...it,
    min_input: savedTariff[it.code]?.min ?? "",
    max_input: savedTariff[it.code]?.max ?? "",
    med_input: savedTariff[it.code]?.med ?? "",
    freq_input: savedTariff[it.code]?.freq ?? ""
  }));
  const persistTariff = debounce(() => {
    const out = {};
    for (const it of state) {
      if (it.min_input || it.max_input || it.med_input || it.freq_input) {
        out[it.code] = { min: it.min_input, max: it.max_input, med: it.med_input, freq: it.freq_input };
      }
    }
    Store.set("bigeup.tariff", out);
  }, 400);

  const numInput = (cls, i, val, ph) =>
    `<input type="number" min="0" class="bg-num ${cls}" value="${esc(val)}" placeholder="${esc(ph)}" data-i="${i}" aria-label="${cls === "bg-freq" ? "실시빈도" : "단가"}">`;

  const render = () => {
    tbody.innerHTML = state.map((it, i) => `
      <tr data-i="${i}">
        <td class="code">${esc(it.code)}</td>
        <td>${esc(it.name)} <span class="bg-unit">/ ${esc(it.unit)}</span></td>
        <td><span class="pill info">${esc(it.category)}</span></td>
        <td>${numInput("bg-min", i, it.min_input, fmtKRW(it.min))}</td>
        <td>${numInput("bg-max", i, it.max_input, fmtKRW(it.max))}</td>
        <td>${numInput("bg-med", i, it.med_input, fmtKRW(Math.round((it.min + it.max) / 2)))}</td>
        <td>${numInput("bg-freq", i, it.freq_input, String(it.freq))}</td>
      </tr>
    `).join("");
    tbody.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", e => {
        const i = +e.target.dataset.i;
        const f = e.target.classList.contains("bg-min") ? "min_input"
                : e.target.classList.contains("bg-max") ? "max_input"
                : e.target.classList.contains("bg-med") ? "med_input"
                : "freq_input";
        state[i][f] = e.target.value;
        updateSummary();
        persistTariff();
      });
    });
  };

  const updateSummary = () => {
    let done = 0, empty = 0, errs = 0, noFreq = 0;
    for (const it of state) {
      const a = +it.min_input, b = +it.max_input, c = +it.med_input;
      const filled = !!(it.min_input && it.max_input);
      if (filled) {
        done++;
        const mid = c || Math.round((a + b) / 2);
        if (a > b || mid < a || mid > b || a < 0) errs++;
        if (it.freq_input === "" || +it.freq_input < 0) noFreq++;
      } else {
        empty++;
      }
    }
    $("#bg-done").textContent = done;
    $("#bg-empty").textContent = empty;
    $("#bg-err").textContent = errs;
    $("#bg-download").disabled = done === 0 || errs > 0 || !$("#bg-ykiho").value.trim();

    if (errs > 0) {
      setStatus($("#bg-status"), "err",
        `검증 오류 ${errs}건 — 최저 ≤ 중간 ≤ 최고 규칙을 확인하세요.`);
    } else if (done > 0) {
      setStatus($("#bg-status"), noFreq ? "warn" : null,
        `${done}개 항목 단가 입력 완료${noFreq ? ` · 실시빈도 미입력 ${noFreq}개` : ""} — 비급여 보고 준비표를 내려받을 수 있습니다.`);
    } else {
      $("#bg-status").style.display = "none";
    }
    $("#bg-summary").innerHTML = `완료 <strong>${done}</strong> · 미입력 <strong>${empty}</strong> · 오류 <strong>${errs}</strong>${noFreq ? ` · 빈도 미입력 <strong>${noFreq}</strong>` : ""}`;
  };

  const fillPrefill = () => {
    for (const it of state) {
      it.min_input = it.min;
      it.max_input = it.max;
      it.med_input = Math.round((it.min + it.max) / 2);
      it.freq_input = it.freq;
    }
    render();
    updateSummary();
  };

  $("#bg-prefill").addEventListener("click", () => {
    fillPrefill();
    persistTariff();
    ActivityLog.push("bigeup", "비급여 표본 단가·빈도 자동 채움", {});
  });

  $('[data-action="run-bigeup"]').addEventListener("click", () => {
    if (!$("#bg-ykiho").value.trim()) $("#bg-ykiho").value = "11000123";
    if (!$("#bg-clinic").value.trim()) $("#bg-clinic").value = "한솔 한방병원";
    if (!$("#bg-date").value) $("#bg-date").value = todayISO();
    fillPrefill();
    setStatus($("#bg-status"), null,
      `${N}개 한방 비급여 예시 항목에 표본 단가·실시빈도가 채워졌습니다 — 검증 결과와 비급여 보고 준비표(XLSX)를 내려받아 확인해보세요.`);
  });

  $("#bg-ykiho").addEventListener("input", updateSummary);

  $("#bg-download").addEventListener("click", () => {
    const ykiho = $("#bg-ykiho").value.trim();
    const clinic = $("#bg-clinic").value.trim() || "—";
    const date = $("#bg-date").value || todayISO();
    const rows = state.filter(it => it.min_input && it.max_input).map(it => {
      const a = +it.min_input, b = +it.max_input;
      const mid = +it.med_input || Math.round((a + b) / 2);
      return {
        "요양기관기호":       ykiho,
        "의료기관명":         clinic,
        "예시코드":           it.code,
        "항목명(예시)":        it.name,
        "분류":               it.category,
        "단위":               it.unit,
        "최저금액":           a,
        "최고금액":           b,
        "중간금액":           mid,
        "실시빈도(참고월 건수)": it.freq_input === "" ? "" : +it.freq_input,
        "참고월":             `${nextWin.refMonth}월`,
        "기준일":             date,
        "비고":               "예시 항목 — 실제 항목코드는 심평원 표준코드 목록으로 대체"
      };
    });
    downloadXLSX(rows, `비급여_보고_준비표_${ykiho}_${date}.xlsx`, "비급여 보고 준비표"); // watermark + _PoC applied inside
    ActivityLog.push("bigeup", `비급여 보고 준비표 내려받음 (${rows.length}개 항목)`, {});
  });

  // init — restore date + hospital fields, then render
  $("#bg-date").value = todayISO();
  ["bg-ykiho", "bg-clinic", "bg-date"].forEach(id => bindPersist("#" + id, "bigeup.profile." + id));
  render();
  updateSummary();
}
