/* clinic-admin — Tab 06
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, $$, fmtKRW, todayISO, fuzzyMatch } from "../core/ui.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { downloadXLSX } from "../core/files.js";
import { activateTab } from "../core/nav.js";

/* ─────────────────────────────────────────────────────────
   Tab 6 — 통합 코드 검색
   ───────────────────────────────────────────────────────── */
export function initTab6(ctx) {
  const { DATA } = ctx;
  let activeFilter = "all";
  let lastResults = [];

  // build unified index
  const all = [
    ...DATA.kcd.mappings.map(m => ({
      source: "kcd",
      source_label: "KCD",
      code: m.kcd8,
      alt_code: m.kcd9 !== m.kcd8 ? m.kcd9 : "",
      name: m.name,
      category: m.category,
      extra: m.type === "split" ? `세분류: ${(m.candidates || []).join(" / ")}` : "",
      ref_date: DATA.kcd.effective_date
    })),
    ...DATA.jabo.items.map(it => ({
      source: "jabo",
      source_label: "자보 수가",
      code: it.code,
      alt_code: "",
      name: it.name,
      category: it.category,
      extra: `${fmtKRW(it.price)}원 / ${it.unit}`,
      ref_date: DATA.jabo.effective_date
    })),
    ...DATA.bigeup.items.map(it => ({
      source: "bigeup",
      source_label: "비급여",
      code: it.code,
      alt_code: "",
      name: it.name,
      category: it.category,
      extra: `${fmtKRW(it.min)}~${fmtKRW(it.max)}원 / ${it.unit}`,
      ref_date: DATA.bigeup.effective_date
    }))
  ];

  const matches = (q, item) =>
    fuzzyMatch(item.name, q) ||
    fuzzyMatch(item.code, q) ||
    (item.alt_code && fuzzyMatch(item.alt_code, q)) ||
    fuzzyMatch(item.category, q);

  const render = (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      $("#search-result").innerHTML = `<div class="empty-state">예) "요통", "추나", "BC0001", "ㅇㅈ"</div>`;
      $("#search-summary").textContent = "검색어를 입력하세요.";
      $("#search-download").disabled = true;
      lastResults = [];
      return;
    }
    const results = all
      .filter(it => activeFilter === "all" || it.source === activeFilter)
      .filter(it => matches(trimmed, it))
      .slice(0, 200);
    lastResults = results;

    $("#search-summary").innerHTML = `<strong>${results.length}건</strong> · "${trimmed}" — ${activeFilter === "all" ? "전체" : results[0]?.source_label || "—"}`;
    $("#search-download").disabled = results.length === 0;

    if (!results.length) {
      $("#search-result").innerHTML = `<div class="empty-state">검색 결과가 없습니다.</div>`;
      return;
    }

    $("#search-result").innerHTML = `
      <table>
        <thead><tr>
          <th>구분</th><th class="code">코드</th><th>명칭</th>
          <th>분류</th><th>가격/메모</th><th class="code">기준일</th>
        </tr></thead>
        <tbody>
          ${results.map(r => {
            const sourceCls = r.source === "kcd" ? "info" : r.source === "jabo" ? "warn" : "ok";
            return `<tr>
              <td><span class="pill ${sourceCls}">${r.source_label}</span></td>
              <td class="code">${r.code}${r.alt_code ? `<br><span style="color:var(--faint); font-size:10px">← ${r.alt_code}</span>` : ""}</td>
              <td>${r.name}</td>
              <td>${r.category || "—"}</td>
              <td>${r.extra || "—"}</td>
              <td class="code" style="color:var(--muted)">${r.ref_date}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  };

  const input = $("#search-input");
  let debounceT;
  input.addEventListener("input", e => {
    clearTimeout(debounceT);
    debounceT = setTimeout(() => render(e.target.value), 80);
  });

  $$(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      $$(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.source;
      render(input.value);
    });
  });

  $("#search-download").addEventListener("click", () => {
    if (!lastResults.length) return;
    const rows = lastResults.map(r => ({
      구분: r.source_label,
      코드: r.code,
      이전코드: r.alt_code,
      명칭: r.name,
      분류: r.category,
      비고: r.extra,
      기준일: r.ref_date
    }));
    downloadXLSX(rows, `통합검색_${input.value.trim()}_${todayISO()}.xlsx`, "검색결과");
  });

  $('[data-action="run-search"]').addEventListener("click", () => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    $('.filter-chip[data-source="all"]').classList.add("active");
    activeFilter = "all";
    input.value = "요통";
    input.focus();
    render("요통");
    ActivityLog.push("search", `통합검색 시연 — "요통"`, {});
  });

  // Cross-tab link: open Tab 6 with a prefilled query
  EventBus.on("search:query", (q) => {
    if (!q) return;
    activateTab("tab-search");
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    $('.filter-chip[data-source="all"]').classList.add("active");
    activeFilter = "all";
    input.value = q;
    input.focus();
    render(q);
  });
}
