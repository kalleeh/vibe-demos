/* clinic-admin — Tab 04 · 비급여 보고 준비표 */
import { $, $$, esc, fmtKRW, todayISO, setStatus, debounce } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { Store, ActivityLog, bindPersist } from "../core/store.js";
import { downloadXLSX, headerRow } from "../core/files.js";
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
  const catLabel = (c) => tOr("bigeup.cat." + c, c);
  const unitLabel = (u) => tOr("common.unit." + u, u);
  // Row count is computed, never hard-coded in copy (re-filled after every language swap).
  const fillCounts = () => $$("[data-bg-count]").forEach(el => el.textContent = String(N));
  fillCounts();

  // Deadline copy — next submission window from the shared calendar.
  const now = new Date();
  const nextWin = BIGEUP_WINDOWS
    .map(w => ({ ...w, date: nextOccurrence(w.month, null, now) }))
    .sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const renderWindow = () => {
    const winEl = $("#bg-window");
    if (winEl) winEl.textContent = t("bigeup.window", { m: nextWin.refMonth, y: nextWin.date.slice(0, 4), mm: +nextWin.date.slice(5, 7) });
  };
  renderWindow();

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
    `<input type="number" min="0" class="bg-num ${cls}" value="${esc(val)}" placeholder="${esc(ph)}" data-i="${i}" aria-label="${esc(t(cls === "bg-freq" ? "bigeup.ariaFreq" : "bigeup.ariaPrice"))}">`;

  const render = () => {
    tbody.innerHTML = state.map((it, i) => `
      <tr data-i="${i}">
        <td class="code">${esc(it.code)}</td>
        <td>${esc(pick(it, "name"))} <span class="bg-unit">/ ${esc(unitLabel(it.unit))}</span></td>
        <td><span class="pill info">${esc(catLabel(it.category))}</span></td>
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

  let lastStatus = null; // null → hidden; { kind, fn } otherwise (the summary strip is recomputed instead)
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
      lastStatus = { kind: "err", fn: () => t("bigeup.statusErr", { n: errs }) };
    } else if (done > 0) {
      lastStatus = { kind: noFreq ? "warn" : null, fn: () => t("bigeup.statusDone", { n: done, nf: noFreq ? t("bigeup.statusNoFreq", { n: noFreq }) : "" }) };
    } else {
      lastStatus = null;
    }
    if (lastStatus) setStatus($("#bg-status"), lastStatus.kind, lastStatus.fn()); else $("#bg-status").style.display = "none";
    $("#bg-summary").innerHTML = t("bigeup.summary", { d: done, e: empty, x: errs }) + (noFreq ? t("bigeup.summaryNoFreq", { n: noFreq }) : "");
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
    ActivityLog.push("bigeup", t("bigeup.logPrefill"), {});
  });

  $('[data-action="run-bigeup"]').addEventListener("click", () => {
    if (!$("#bg-ykiho").value.trim()) $("#bg-ykiho").value = "11000123";
    if (!$("#bg-clinic").value.trim()) $("#bg-clinic").value = "한솔 한방병원";
    if (!$("#bg-date").value) $("#bg-date").value = todayISO();
    fillPrefill();
    lastStatus = { kind: null, fn: () => t("bigeup.statusSample", { n: N }) };
    setStatus($("#bg-status"), null, lastStatus.fn());
  });

  $("#bg-ykiho").addEventListener("input", updateSummary);

  $("#bg-download").addEventListener("click", () => {
    const ykiho = $("#bg-ykiho").value.trim();
    const clinic = $("#bg-clinic").value.trim() || "—";
    const date = $("#bg-date").value || todayISO();
    const rows = state.filter(it => it.min_input && it.max_input).map(it => {
      const a = +it.min_input, b = +it.max_input;
      const mid = +it.med_input || Math.round((a + b) / 2);
      return headerRow([
        ["bigeup.col.ykiho", ykiho], ["bigeup.col.clinic", clinic], ["bigeup.col.code", it.code], ["bigeup.col.name", pick(it, "name")],
        ["bigeup.col.cat", catLabel(it.category)], ["bigeup.col.unit", unitLabel(it.unit)], ["bigeup.col.min", a], ["bigeup.col.max", b], ["bigeup.col.mid", mid],
        ["bigeup.col.freq", it.freq_input === "" ? "" : +it.freq_input], ["bigeup.col.refMonth", t("bigeup.refMonthVal", { m: nextWin.refMonth })],
        ["bigeup.col.date", date], ["bigeup.col.note", t("bigeup.noteVal")]
      ]);
    });
    downloadXLSX(rows, t("bigeup.file", { ykiho, date }), t("bigeup.sheet")); // watermark + _PoC applied inside
    ActivityLog.push("bigeup", t("bigeup.logDl", { n: rows.length }), {});
  });

  // init — restore date + hospital fields, then render
  $("#bg-date").value = todayISO();
  ["bg-ykiho", "bg-clinic", "bg-date"].forEach(id => bindPersist("#" + id, "bigeup.profile." + id));
  render();
  updateSummary();

  onLangChange(() => {
    fillCounts(); renderWindow(); render(); updateSummary();
  });
}
