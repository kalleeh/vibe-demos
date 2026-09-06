/* clinic-admin — Tab 06 · 통합 코드 검색 + 마스터 업로드
   Searches the uploaded masters (KOICD 상병 / 심평원 행위·수가) when present, else the
   bundled 발췌·예시 tables, with a source badge per row. Hosts the master upload/clear UI. */
import { $, $$, esc, fmtKRW, todayISO, fuzzyMatch } from "../core/ui.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Masters } from "../core/masters.js";

export function initTab6(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  let activeFilter = "all";
  let lastResults = [];
  let all = [];

  const SRC = { master: "업로드 마스터", bundled: "데모 발췌" };
  const flagsOf = (r) => {
    const f = [];
    if (r.coverage === "급여") f.push(["급여", "ok"]);
    else if (r.coverage === "비급여") f.push(["비급여", "warn"]);
    if (r.jabo) f.push(["자보", "info"]);
    return f;
  };

  const buildIndex = () => {
    const k = Masters.kcd(), f = Masters.fee();
    all = [
      ...k.rows.map(m => ({
        source: "kcd", source_label: "KCD", origin: k.source, code: m.code, alt_code: m.edi && m.edi !== m.code ? m.edi : "",
        name: m.name, category: m.category || (m.complete === false ? "상위분류" : ""), extra: m.name_en || "", flags: [], ref_date: k.date
      })),
      ...f.rows.map(it => ({
        source: "jabo", source_label: f.source === "master" ? "행위·수가" : "자보 수가(예시)", origin: f.source, code: it.code, alt_code: "",
        name: it.name, category: it.category || "", extra: it.price == null ? (it.note || "") : `${fmtKRW(it.price)}원 / ${it.unit || "회"}`, flags: flagsOf(it), ref_date: f.date
      })),
      ...DATA.bigeup.items.map(it => ({
        source: "bigeup", source_label: "비급여", origin: "bundled", code: it.code, alt_code: "",
        name: it.name, category: it.category, extra: `${fmtKRW(it.min)}~${fmtKRW(it.max)}원 / ${it.unit}`, flags: [["비급여", "warn"]], ref_date: DATA.bigeup.effective_date
      }))
    ];
  };
  buildIndex();

  const matches = (q, item) =>
    fuzzyMatch(item.name || "", q) || fuzzyMatch(item.code, q) ||
    (item.alt_code && fuzzyMatch(item.alt_code, q)) || fuzzyMatch(item.category || "", q);

  const render = (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      $("#search-result").innerHTML = `<div class="empty-state">예) "요통", "추나", "S13.4", "ㅇㅈ"</div>`;
      $("#search-summary").textContent = "검색어를 입력하세요.";
      $("#search-download").disabled = true;
      lastResults = [];
      return;
    }
    const results = all.filter(it => activeFilter === "all" || it.source === activeFilter).filter(it => matches(trimmed, it)).slice(0, 200);
    lastResults = results;
    $("#search-summary").innerHTML = `<strong>${results.length}건</strong> · "${esc(trimmed)}" — ${activeFilter === "all" ? "전체" : esc(results[0]?.source_label || "—")}`;
    $("#search-download").disabled = results.length === 0;
    if (!results.length) { $("#search-result").innerHTML = `<div class="empty-state">검색 결과가 없습니다.</div>`; return; }
    $("#search-result").innerHTML = `
      <table>
        <thead><tr>
          <th>구분</th><th class="code">코드</th><th>명칭</th><th>분류</th><th>급여/자보</th><th>가격/메모</th><th>출처</th><th class="code">기준일</th>
        </tr></thead>
        <tbody>
          ${results.map(r => {
            const sourceCls = r.source === "kcd" ? "info" : r.source === "jabo" ? "warn" : "ok";
            return `<tr>
              <td><span class="pill ${sourceCls}">${esc(r.source_label)}</span></td>
              <td class="code">${esc(r.code)}${r.alt_code ? `<br><span style="color:var(--faint); font-size:10px">EDI ${esc(r.alt_code)}</span>` : ""}</td>
              <td>${esc(r.name)}</td><td>${esc(r.category) || "—"}</td>
              <td>${r.flags.length ? r.flags.map(([t, c]) => `<span class="pill ${c}">${t}</span>`).join(" ") : "—"}</td>
              <td>${esc(r.extra) || "—"}</td>
              <td><span class="src-pill ${r.origin === "master" ? "master" : "demo"}">${SRC[r.origin]}</span></td>
              <td class="code" style="color:var(--muted)">${esc(r.ref_date) || "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  };

  const input = $("#search-input");
  let debounceT;
  input.addEventListener("input", e => { clearTimeout(debounceT); debounceT = setTimeout(() => render(e.target.value), 80); });
  $$(".filter-chip").forEach(chip => chip.addEventListener("click", () => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.source;
    render(input.value);
  }));

  $("#search-download").addEventListener("click", () => {
    if (!lastResults.length) return;
    const rows = lastResults.map(r => ({ 구분: r.source_label, 코드: r.code, EDI: r.alt_code, 명칭: r.name, 분류: r.category, "급여/자보": r.flags.map(f => f[0]).join(" "), 비고: r.extra, 출처: SRC[r.origin], 기준일: r.ref_date }));
    downloadXLSX(rows, `통합검색_${input.value.trim()}_${todayISO()}.xlsx`, "검색결과");
  });

  const goSearch = (q) => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    $('.filter-chip[data-source="all"]').classList.add("active");
    activeFilter = "all";
    input.value = q; input.focus(); render(q);
  };
  $('[data-action="run-search"]').addEventListener("click", () => { goSearch("요통"); ActivityLog.push("search", `통합검색 시연 — "요통"`, {}); });
  EventBus.on("search:query", (q) => { if (!q) return; activateTab("tab-search"); goSearch(q); });

  /* ───────────── Master upload (KOICD 상병 / 심평원 행위·수가) ───────────── */
  const pending = { kcd: null, fee: null }; // {fileName, headers, rows}

  const renderMasterStatus = () => {
    for (const kind of ["kcd", "fee"]) {
      const rec = Masters.get(kind);
      const el = $(`#master-status-${kind}`);
      const clearBtn = $(`#master-clear-${kind}`);
      if (!el) continue;
      if (rec) {
        el.innerHTML = `<span class="src-pill master">업로드본</span> ${rec.count.toLocaleString("ko-KR")}행 · ${esc(rec.uploadedAt)}${rec.fileName ? ` · ${esc(rec.fileName)}` : ""}`;
        clearBtn.disabled = false;
      } else {
        const cur = kind === "kcd" ? Masters.kcd() : Masters.fee();
        el.innerHTML = `<span class="src-pill demo">데모</span> ${esc(cur.label)}`;
        clearBtn.disabled = true;
      }
    }
    $("#search-source-badge").innerHTML =
      `<span class="src-pill ${Masters.kcd().source === "master" ? "master" : "demo"}">상병 · ${esc(Masters.kcd().label)}</span>
       <span class="src-pill ${Masters.fee().source === "master" ? "master" : "demo"}">행위 · ${esc(Masters.fee().label)}</span>`;
  };

  const renderMapping = (kind) => {
    const box = $(`#master-map-${kind}`);
    const p = pending[kind];
    if (!p) { box.innerHTML = ""; box.hidden = true; return; }
    const spec = Masters.FIELDS[kind];
    const sug = Masters.suggestMapping(kind, p.headers);
    box.hidden = false;
    box.innerHTML = `
      <div class="map-head">헤더 매핑 — <strong>${esc(p.fileName)}</strong> · ${p.rows.length.toLocaleString("ko-KR")}행 · 필수: ${spec.required.map(f => spec.fields[f].label).join(", ")}</div>
      ${Object.entries(spec.fields).map(([f, def]) => `
        <label class="map-row"><span>${esc(def.label)}${spec.required.includes(f) ? " *" : ""}</span>
          <select data-field="${f}"><option value="">— 없음 —</option>${p.headers.map(h => `<option value="${esc(h)}"${sug[f] === h ? " selected" : ""}>${esc(h)}</option>`).join("")}</select>
        </label>`).join("")}
      <div class="map-actions">
        <button type="button" class="btn" data-map-save="${kind}">마스터로 저장</button>
        <button type="button" class="btn secondary" data-map-cancel="${kind}">취소</button>
        <span class="map-msg" id="master-map-msg-${kind}"></span>
      </div>`;
    box.querySelector(`[data-map-cancel]`).addEventListener("click", () => { pending[kind] = null; renderMapping(kind); });
    box.querySelector(`[data-map-save]`).addEventListener("click", async () => {
      const mapping = {};
      box.querySelectorAll("select[data-field]").forEach(s => { if (s.value) mapping[s.dataset.field] = s.value; });
      const missing = spec.required.filter(f => !mapping[f]);
      const msg = $(`#master-map-msg-${kind}`);
      if (missing.length) { msg.textContent = `필수 컬럼 미지정: ${missing.map(f => spec.fields[f].label).join(", ")}`; return; }
      const rows = Masters.normalizeRows(kind, p.rows, mapping);
      if (!rows.length) { msg.textContent = "코드로 인식된 행이 없습니다 — 컬럼 매핑을 확인하세요."; return; }
      try {
        await Masters.put(kind, rows, { fileName: p.fileName, mapping });
        pending[kind] = null; renderMapping(kind);
        ActivityLog.push("search", `${spec.label} 업로드 — ${rows.length}행`, { kind });
      } catch (err) {
        console.error(err); msg.textContent = "저장 실패 — 브라우저 저장공간을 확인하세요.";
      }
    });
  };

  for (const kind of ["kcd", "fee"]) {
    const fileInput = $(`#master-file-${kind}`);
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const rows = await readSpreadsheet(file);
        if (!rows.length) { $(`#master-status-${kind}`).innerHTML = `<span class="pill warn">빈 파일</span>`; return; }
        pending[kind] = { fileName: file.name, headers: Object.keys(rows[0]), rows };
        renderMapping(kind);
      } catch (err) {
        console.error(err);
        $(`#master-status-${kind}`).innerHTML = `<span class="pill err">읽기 실패</span> 형식 확인 필요`;
      } finally { e.target.value = ""; }
    });
    $(`#master-clear-${kind}`).addEventListener("click", async () => {
      await Masters.clear(kind);
      ActivityLog.push("search", `${Masters.FIELDS[kind].label} 삭제 — 데모 발췌본으로 복귀`, { kind });
    });
  }

  Masters.onChange(() => { buildIndex(); renderMasterStatus(); if (input.value.trim()) render(input.value); });
  Masters.ready().then(() => { buildIndex(); renderMasterStatus(); });
  renderMasterStatus();
}
