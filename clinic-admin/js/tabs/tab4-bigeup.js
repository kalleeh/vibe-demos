/* clinic-admin — Tab 04 · 비급여 보고 준비표 */
import { $, $$, esc, fmtKRW, todayISO, setStatus, debounce } from "../core/ui.js";
import { t, tOr, pick, getLang, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { downloadXLSX, headerRow, pocMark } from "../core/files.js";
import { bigeupWindows, nextOccurrence } from "../core/calendar.js";
import { activateTab } from "../core/nav.js";
import { Org, Tariff } from "../core/entities.js";
import { renderOrgReadOnly, orgView, orgHeaderPairs } from "./reporting-shared.js";

/* ─────────────────────────────────────────────────────────
   Tab 4 — 비급여 진료비용 보고 준비 (의료법 §45조의2)
   The hospital enters, per 예시 item, its 단가 (최저·최고·중간) and 실시빈도 (참고월 건수). 심평원 derives
   the published distribution from what every institution submits — min/max/mid here are only a local
   sanity check. Items are 예시; real codes come from the 심평원 비급여 보고 표준코드 목록.
   · Institution fields are read from Org (edited in the shell's info modal). Org.kind decides the cadence:
     병원급 reports March + September data (twice a year), 의원급 March only.
   · Prices live in the Tariff entity (Tariff.get/set/all), the 적용일 in Tariff.effectiveDate.
   · 가격 고지문 — a printable 비급여 가격표 for the 접수 counter (의료법 §45 고지 duty), PoC-watermarked.
   ───────────────────────────────────────────────────────── */
let api = null;
export function seed() { api?.seed(); }

export function init(ctx) {
  const { DATA } = ctx;
  const tbody = $("#bg-tbody");
  const items = DATA.bigeup.items;
  const N = items.length;
  const catLabel = (c) => tOr("bigeup.cat." + c, c);
  const unitLabel = (u) => tOr("common.unit." + u, u);
  const fillCounts = () => $$("[data-bg-count]").forEach(el => el.textContent = String(N));
  fillCounts();

  // ── institution (read-only) + cadence from Org.kind (core/calendar.js bigeupWindows — same list as 00's deadlines) ──
  const org = () => orgView(Org.get());
  const windows = bigeupWindows;
  const renderOrg = () => renderOrgReadOnly($("#bg-org"), Org.get(), { onEdit: () => activateTab("tab-org") }); // 조직 › 기관 프로필

  // ── 참고월 select — defaults to the upcoming window; the deadline click from 00 preselects it ──
  const refSel = $("#bg-refmonth");
  const now = new Date();
  const upcoming = () => windows().map(w => ({ ...w, date: nextOccurrence(w.month, null, now) })).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const fillRefMonths = (keep) => {
    const cur = keep ?? +refSel.value;
    refSel.innerHTML = windows().map(w => `<option value="${w.refMonth}">${esc(t("bigeup.refMonthOpt", { m: w.refMonth, mm: w.month }))}</option>`).join("");
    const valid = windows().some(w => w.refMonth === cur);
    refSel.value = String(valid ? cur : upcoming().refMonth);
  };
  fillRefMonths(upcoming().refMonth);
  const selectedWindow = () => {
    const w = windows().find(x => x.refMonth === +refSel.value) || upcoming();
    return { ...w, date: nextOccurrence(w.month, null, now) };
  };
  const renderWindow = () => {
    const w = selectedWindow();
    const winEl = $("#bg-window");
    if (winEl) winEl.textContent = t("bigeup.window", { m: w.refMonth, y: w.date.slice(0, 4), mm: +w.date.slice(5, 7) });
    const rule = $("#bg-rule");
    if (rule) rule.textContent = org().clinicLevel ? t("bigeup.ruleOnce") : t("bigeup.ruleTwice");
  };
  refSel.addEventListener("change", () => { renderWindow(); updateSummary(); });

  // ── state ← Tariff ──
  const fromTariff = (it) => {
    const v = Tariff.get(it.code) || {};
    return { min_input: v.min ?? "", max_input: v.max ?? "", med_input: v.med ?? "", freq_input: v.freq ?? "" };
  };
  const state = items.map(it => ({ ...it, ...fromTariff(it) }));
  const reloadState = () => { for (const it of state) Object.assign(it, fromTariff(it)); };
  const dirty = new Set();
  const flushDirty = debounce(() => {
    for (const code of dirty) {
      const it = state.find(x => x.code === code);
      const has = it && (it.min_input !== "" || it.max_input !== "" || it.med_input !== "" || it.freq_input !== "");
      Tariff.set(code, has ? { min: it.min_input, max: it.max_input, med: it.med_input, freq: it.freq_input } : null);
    }
    dirty.clear();
  }, 400);
  const writeAll = () => { for (const it of state) dirty.add(it.code); flushDirty(); };

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
        dirty.add(state[i].code);
        updateSummary();
        flushDirty();
      });
    });
  };

  const filled = (it) => it.min_input !== "" && it.max_input !== "";
  const midOf = (it) => +it.med_input || Math.round((+it.min_input + +it.max_input) / 2);

  // ── 가격 고지문 (printable 비급여 가격표 for the 접수 counter) ──
  const noticeRows = () => state.filter(filled).map(it => ({ code: it.code, name: pick(it, "name"), unit: unitLabel(it.unit), cat: catLabel(it.category), price: midOf(it), min: +it.min_input, max: +it.max_input }));
  const noticeHTML = (rows) => {
    const o = org();
    const date = Tariff.effectiveDate() || todayISO();
    return `
      <div class="bg-notice-head">
        <h5>${esc(t("bigeup.notice.title", { org: o.name || t("reporting.org.missing") }))}</h5>
        <p>${esc(t("bigeup.notice.sub", { date, n: rows.length }))}</p>
      </div>
      <table class="bg-notice-table">
        <thead><tr><th>${esc(t("common.thCategory"))}</th><th>${esc(t("bigeup.thName"))}</th><th class="code">${esc(t("bigeup.notice.thPrice"))}</th><th class="code">${esc(t("bigeup.notice.thRange"))}</th><th class="code">${esc(t("bigeup.fDate"))}</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(r.cat)}</td><td>${esc(r.name)} <span class="bg-unit">/ ${esc(r.unit)}</span></td><td class="code" style="text-align:right">${fmtKRW(r.price)}</td><td class="code" style="text-align:right">${fmtKRW(r.min)} – ${fmtKRW(r.max)}</td><td class="code">${esc(date)}</td></tr>`).join("")}</tbody>
      </table>
      <p class="bg-notice-foot">${esc(t("bigeup.notice.foot", { org: o.name || "—", rep: o.rep || "—", ykiho: o.ykiho || "—" }))}</p>
      <p class="bg-notice-mark">${esc(pocMark())}</p>`;
  };
  const renderNotice = () => {
    const rows = noticeRows();
    const box = $("#bg-notice");
    const btn = $("#bg-notice-print");
    if (!box) return;
    box.innerHTML = rows.length ? noticeHTML(rows) : `<div class="empty-state">${esc(t("bigeup.notice.empty"))}</div>`;
    if (btn) btn.disabled = rows.length === 0;
  };
  $("#bg-notice-print")?.addEventListener("click", () => {
    const rows = noticeRows();
    if (!rows.length) return;
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) { window.print(); return; }
    const css = `body{font:13px/1.5 -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111;margin:28px;} h5{font-size:20px;margin:0 0 4px;} p{margin:2px 0 12px;color:#444;} table{width:100%;border-collapse:collapse;font-size:12.5px;} th,td{border-bottom:1px solid #999;padding:6px 8px;text-align:left;} th{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#333;} .code{font-family:ui-monospace,Menlo,monospace;} .bg-unit{color:#777;font-size:11px;} .bg-notice-foot{margin-top:14px;font-size:12px;} .bg-notice-mark{margin-top:18px;padding-top:6px;border-top:1px solid #000;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:1.5px;text-align:center;}`;
    w.document.write(`<!doctype html><html lang="${esc(getLang())}"><head><meta charset="utf-8"><title>${esc(t("bigeup.notice.docTitle"))}</title><style>${css}</style></head><body>${noticeHTML(rows)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 250);
    ActivityLog.push("bigeup", t("bigeup.notice.log", { n: rows.length }), {});
  });

  let lastStatus = null; // null → hidden; { kind, fn } otherwise (the summary strip is recomputed instead)
  const updateSummary = () => {
    let done = 0, empty = 0, errs = 0, noFreq = 0;
    for (const it of state) {
      const a = +it.min_input, b = +it.max_input, c = +it.med_input;
      if (filled(it)) {
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
    const ykiho = org().ykiho;
    $("#bg-download").disabled = done === 0 || errs > 0 || !ykiho;

    if (errs > 0) {
      lastStatus = { kind: "err", fn: () => t("bigeup.statusErr", { n: errs }) };
    } else if (done > 0 && !ykiho) {
      lastStatus = { kind: "warn", fn: () => t("bigeup.statusNoOrg") };
    } else if (done > 0) {
      lastStatus = { kind: noFreq ? "warn" : null, fn: () => t("bigeup.statusDone", { n: done, nf: noFreq ? t("bigeup.statusNoFreq", { n: noFreq }) : "" }) };
    } else {
      lastStatus = null;
    }
    if (lastStatus) setStatus($("#bg-status"), lastStatus.kind, lastStatus.fn()); else $("#bg-status").style.display = "none";
    $("#bg-summary").innerHTML = t("bigeup.summary", { d: done, e: empty, x: errs }) + (noFreq ? t("bigeup.summaryNoFreq", { n: noFreq }) : "");
    renderNotice();
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
    writeAll();
    ActivityLog.push("bigeup", t("bigeup.logPrefill"), {});
  });

  // ── 적용일 ↔ Tariff.effectiveDate ──
  const dateEl = $("#bg-date");
  dateEl.value = Tariff.effectiveDate() || "";
  dateEl.addEventListener("change", () => { Tariff.setEffectiveDate(dateEl.value); renderNotice(); });

  const runSample = () => {
    if (!dateEl.value) { dateEl.value = todayISO(); Tariff.setEffectiveDate(dateEl.value); }
    fillPrefill();
    writeAll();
    lastStatus = { kind: null, fn: () => t("bigeup.statusSample", { n: N }) };
    setStatus($("#bg-status"), null, lastStatus.fn());
  };
  $('[data-action="run-bigeup"]').addEventListener("click", runSample);

  $("#bg-download").addEventListener("click", () => {
    const o = Org.get();
    const date = Tariff.effectiveDate() || todayISO();
    const w = selectedWindow();
    const rows = state.filter(filled).map(it => {
      const a = +it.min_input, b = +it.max_input;
      return headerRow([
        ...orgHeaderPairs(o), ["bigeup.col.code", it.code], ["bigeup.col.name", pick(it, "name")],
        ["bigeup.col.cat", catLabel(it.category)], ["bigeup.col.unit", unitLabel(it.unit)], ["bigeup.col.min", a], ["bigeup.col.max", b], ["bigeup.col.mid", midOf(it)],
        ["bigeup.col.freq", it.freq_input === "" ? "" : +it.freq_input], ["bigeup.col.refMonth", t("bigeup.refMonthVal", { m: w.refMonth })],
        ["bigeup.col.date", date], ["bigeup.col.note", t("bigeup.noteVal")]
      ]);
    });
    downloadXLSX(rows, t("bigeup.file", { ykiho: orgView(o).ykiho || "org", date }), t("bigeup.sheet")); // watermark + _PoC applied inside
    ActivityLog.push("bigeup", t("bigeup.logDl", { n: rows.length }), {});
  });

  // ── live wiring ──
  Org.onChange(() => { renderOrg(); fillRefMonths(); renderWindow(); updateSummary(); });
  // Tariff changed elsewhere (another tab / a peer window) — re-sync unless the user is typing in this table.
  Tariff.onChange(() => {
    if (tbody.contains(document.activeElement) || dirty.size) return;
    reloadState(); render(); updateSummary();
    if (document.activeElement !== dateEl) dateEl.value = Tariff.effectiveDate() || "";
  });
  // ctx from 00 (deadline row) — { refMonth: "yyyy-mm" | 3 | 9 } preselects the 참고월.
  EventBus.on("tab:activated", (p) => {
    const c = p?.id === "tab-bigeup" ? p.ctx : null;
    if (!c?.refMonth) return;
    fillRefMonths(+String(c.refMonth).slice(-2));
    renderWindow(); updateSummary();
    refSel.focus({ preventScroll: true });
  });

  // init
  renderOrg(); renderWindow(); render(); updateSummary();

  onLangChange(() => {
    fillCounts(); renderOrg(); fillRefMonths(); renderWindow(); render(); updateSummary();
  });

  api = { seed: runSample };
}
