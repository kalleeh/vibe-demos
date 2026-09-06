/* clinic-admin — Tab 04
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, fmtKRW, todayISO, setStatus, debounce } from "../core/ui.js";
import { Store, ActivityLog, bindPersist } from "../core/store.js";
import { downloadXLSX } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   Tab 4 — 비급여 진료비용 공개
   ───────────────────────────────────────────────────────── */
export function initTab4(ctx) {
  const { DATA } = ctx;
  const tbody = $("#bg-tbody");
  // Restore last-saved tariff if any
  const savedTariff = Store.get("bigeup.tariff", {});
  const state = DATA.bigeup.items.map(it => ({
    ...it,
    min_input: savedTariff[it.code]?.min ?? "",
    max_input: savedTariff[it.code]?.max ?? "",
    med_input: savedTariff[it.code]?.med ?? ""
  }));
  const persistTariff = debounce(() => {
    const out = {};
    for (const it of state) {
      if (it.min_input || it.max_input || it.med_input) {
        out[it.code] = { min: it.min_input, max: it.max_input, med: it.med_input };
      }
    }
    Store.set("bigeup.tariff", out);
  }, 400);

  const render = () => {
    tbody.innerHTML = state.map((it, i) => `
      <tr data-i="${i}">
        <td class="code">${it.code}</td>
        <td>${it.name}</td>
        <td><span class="pill info">${it.category}</span></td>
        <td><input type="number" class="bg-min" value="${it.min_input}" placeholder="${fmtKRW(it.min)}" data-i="${i}" style="width:90px; padding:5px 7px; border:1px solid var(--line); border-radius:3px; font-family:'JetBrains Mono', monospace; font-size:11px; text-align:right; background:rgba(255,255,255,0.6)"></td>
        <td><input type="number" class="bg-max" value="${it.max_input}" placeholder="${fmtKRW(it.max)}" data-i="${i}" style="width:90px; padding:5px 7px; border:1px solid var(--line); border-radius:3px; font-family:'JetBrains Mono', monospace; font-size:11px; text-align:right; background:rgba(255,255,255,0.6)"></td>
        <td><input type="number" class="bg-med" value="${it.med_input}" placeholder="${fmtKRW(Math.round((it.min+it.max)/2))}" data-i="${i}" style="width:90px; padding:5px 7px; border:1px solid var(--line); border-radius:3px; font-family:'JetBrains Mono', monospace; font-size:11px; text-align:right; background:rgba(255,255,255,0.6)"></td>
      </tr>
    `).join("");
    tbody.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", e => {
        const i = +e.target.dataset.i;
        const f = e.target.classList.contains("bg-min") ? "min_input"
                : e.target.classList.contains("bg-max") ? "max_input"
                : "med_input";
        state[i][f] = e.target.value;
        updateSummary();
        persistTariff();
      });
    });
  };

  const updateSummary = () => {
    let done = 0, empty = 0, errs = 0;
    for (const it of state) {
      const a = +it.min_input, b = +it.max_input, c = +it.med_input;
      const filled = !!(it.min_input && it.max_input);
      if (filled) {
        done++;
        const mid = c || Math.round((a + b) / 2);
        if (a > b || mid < a || mid > b) errs++;
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
      setStatus($("#bg-status"), null,
        `${done}개 항목 입력 완료 · HIRA 반기보고 자료 생성 가능.`);
    } else {
      $("#bg-status").style.display = "none";
    }
    $("#bg-summary").innerHTML = `완료 <strong>${done}</strong> · 미입력 <strong>${empty}</strong> · 오류 <strong>${errs}</strong>`;
  };

  const fillPrefill = () => {
    for (const it of state) {
      it.min_input = it.min;
      it.max_input = it.max;
      it.med_input = Math.round((it.min + it.max) / 2);
    }
    render();
    updateSummary();
  };

  $("#bg-prefill").addEventListener("click", fillPrefill);

  $('[data-action="run-bigeup"]').addEventListener("click", () => {
    if (!$("#bg-ykiho").value.trim()) $("#bg-ykiho").value = "11000123";
    if (!$("#bg-clinic").value.trim()) $("#bg-clinic").value = "한솔 한방병원";
    if (!$("#bg-date").value) $("#bg-date").value = todayISO();
    fillPrefill();
    setStatus($("#bg-status"), null,
      "30개 한방 비급여 항목에 표본 단가가 채워졌습니다 — 검증 결과와 HIRA 반기보고용 엑셀을 내려받아 확인해보세요.");
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
        "요양기관기호":   ykiho,
        "의료기관명":     clinic,
        "항목코드":       it.code,
        "항목명":         it.name,
        "진료과목":       "한방",
        "최저금액":       a,
        "최고금액":       b,
        "중간금액":       mid,
        "단위":           it.unit,
        "시행일자":       date,
        "변경구분":       "신규"
      };
    });
    downloadXLSX(rows, `HIRA비급여_반기보고_${ykiho}_${date}.xlsx`, "비급여 반기보고");
  });

  // init — restore date + hospital fields, then render
  $("#bg-date").value = todayISO();
  ["bg-ykiho", "bg-clinic", "bg-date"].forEach(id => bindPersist("#" + id, "bigeup.profile." + id));
  render();
  updateSummary();

  $("#bg-prefill").addEventListener("click", () => {
    persistTariff();
    ActivityLog.push("bigeup", "비급여 표본 단가 자동 채움", {});
  });
  $("#bg-download").addEventListener("click", () => {
    ActivityLog.push("bigeup", `HIRA 비급여 반기보고 자료 내려받음`, {});
  });
}
