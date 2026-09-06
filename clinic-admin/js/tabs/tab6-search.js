/* clinic-admin — Tab 06 · 통합 코드 검색 + 마스터 업로드
   Searches the uploaded masters (KOICD 상병 / 심평원 행위·수가) when present, else the
   bundled 발췌·예시 tables, with a source badge per row. Hosts the master upload/clear UI.
   i18n: bundled rows carry name_en (data/*.json) and uploaded KOICD masters carry the file's 영문명 column, so
   the EN view shows English names where they exist; the index is rebuilt on every language swap. */
import { $, $$, esc, fmtKRW, won, todayISO, fuzzyMatch } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Masters } from "../core/masters.js";

export function initTab6(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  let activeFilter = "all";
  let lastResults = [];
  let all = [];

  const srcLabel = (origin) => t(origin === "master" ? "search.srcMaster" : "search.srcBundled");
  const unitLabel = (u) => tOr("common.unit." + (u || "회"), u || "회");
  const flagsOf = (r) => {
    const f = [];
    if (r.coverage === "급여") f.push([t("search.flag.covered"), "ok"]);
    else if (r.coverage === "비급여") f.push([t("search.flag.noncovered"), "warn"]);
    if (r.jabo) f.push([t("search.flag.jabo"), "info"]);
    return f;
  };
  const catOf = (ns, c) => c ? tOr(ns + ".cat." + c, c) : "";

  const buildIndex = () => {
    const k = Masters.kcd(), f = Masters.fee();
    all = [
      ...k.rows.map(m => ({
        source: "kcd", source_label: "KCD", origin: k.source, code: m.code, alt_code: m.edi && m.edi !== m.code ? m.edi : "",
        name: pick(m, "name"), name_alt: m.name_en || "", name_ko: m.name, category: catOf("kcd", m.category) || (m.complete === false ? t("search.parentClass") : ""), extra: pick(m, "name") === m.name ? (m.name_en || "") : m.name, flags: [], ref_date: k.date
      })),
      ...f.rows.map(it => ({
        source: "jabo", source_label: f.source === "master" ? t("search.lblFee") : t("search.lblFeeExample"), origin: f.source, code: it.code, alt_code: "",
        name: pick(it, "name"), name_alt: it.name_en || "", name_ko: it.name, category: catOf("jabo", it.category), extra: it.price == null ? (pick(it, "note") || "") : `${won(it.price)} / ${unitLabel(it.unit)}`, flags: flagsOf(it), ref_date: f.date
      })),
      ...DATA.bigeup.items.map(it => ({
        source: "bigeup", source_label: t("common.bigeup"), origin: "bundled", code: it.code, alt_code: "",
        name: pick(it, "name"), name_alt: it.name_en || "", name_ko: it.name, category: catOf("bigeup", it.category), extra: `${fmtKRW(it.min)}~${won(it.max)} / ${unitLabel(it.unit)}`, flags: [[t("search.flag.noncovered"), "warn"]], ref_date: DATA.bigeup.effective_date
      }))
    ];
  };
  buildIndex();

  const matches = (q, item) =>
    fuzzyMatch(item.name_ko || "", q) || fuzzyMatch(item.name_alt || "", q) || fuzzyMatch(item.code, q) ||
    (item.alt_code && fuzzyMatch(item.alt_code, q)) || fuzzyMatch(item.category || "", q);

  const render = (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      $("#search-result").innerHTML = `<div class="empty-state">${esc(t("search.empty"))}</div>`;
      $("#search-summary").textContent = t("search.summaryIdle");
      $("#search-download").disabled = true;
      lastResults = [];
      return;
    }
    const results = all.filter(it => activeFilter === "all" || it.source === activeFilter).filter(it => matches(trimmed, it)).slice(0, 200);
    lastResults = results;
    $("#search-summary").innerHTML = t("search.summary", { n: results.length, q: esc(trimmed), scope: activeFilter === "all" ? esc(t("search.filterAll")) : esc(results[0]?.source_label || "—") });
    $("#search-download").disabled = results.length === 0;
    if (!results.length) { $("#search-result").innerHTML = `<div class="empty-state">${esc(t("search.noResults"))}</div>`; return; }
    $("#search-result").innerHTML = `
      <table>
        <thead><tr>
          <th>${esc(t("search.thKind"))}</th><th class="code">${esc(t("jabo.thCodeShort"))}</th><th>${esc(t("search.thName"))}</th><th>${esc(t("common.thCategory"))}</th><th>${esc(t("search.thCoverage"))}</th><th>${esc(t("search.thExtra"))}</th><th>${esc(t("search.thSource"))}</th><th class="code">${esc(t("search.thRefDate"))}</th>
        </tr></thead>
        <tbody>
          ${results.map(r => {
            const sourceCls = r.source === "kcd" ? "info" : r.source === "jabo" ? "warn" : "ok";
            return `<tr>
              <td><span class="pill ${sourceCls}">${esc(r.source_label)}</span></td>
              <td class="code">${esc(r.code)}${r.alt_code ? `<br><span style="color:var(--faint); font-size:10px">EDI ${esc(r.alt_code)}</span>` : ""}</td>
              <td>${esc(r.name)}</td><td>${esc(r.category) || "—"}</td>
              <td>${r.flags.length ? r.flags.map(([tx, c]) => `<span class="pill ${c}">${esc(tx)}</span>`).join(" ") : "—"}</td>
              <td>${esc(r.extra) || "—"}</td>
              <td><span class="src-pill ${r.origin === "master" ? "master" : "demo"}">${esc(srcLabel(r.origin))}</span></td>
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
    const rows = lastResults.map(r => headerRow([
      ["search.col.kind", r.source_label], ["search.col.code", r.code], ["search.col.edi", r.alt_code], ["search.col.name", r.name], ["search.col.cat", r.category],
      ["search.col.coverage", r.flags.map(f => f[0]).join(" ")], ["common.thNote", r.extra], ["search.col.source", srcLabel(r.origin)], ["search.col.refDate", r.ref_date]
    ]));
    downloadXLSX(rows, t("search.file", { q: input.value.trim(), date: todayISO() }), t("search.sheet"));
  });

  const goSearch = (q) => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    $('.filter-chip[data-source="all"]').classList.add("active");
    activeFilter = "all";
    input.value = q; input.focus(); render(q);
  };
  $('[data-action="run-search"]').addEventListener("click", () => { goSearch("요통"); ActivityLog.push("search", t("search.logDemo"), {}); });
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
        el.innerHTML = `<span class="src-pill master">${esc(t("search.uploadedPill"))}</span> ${esc(t("common.nRows", { n: rec.count.toLocaleString("ko-KR") }))} · ${esc(rec.uploadedAt)}${rec.fileName ? ` · ${esc(rec.fileName)}` : ""}`;
        clearBtn.disabled = false;
      } else {
        const cur = kind === "kcd" ? Masters.kcd() : Masters.fee();
        el.innerHTML = `<span class="src-pill demo">${esc(t("search.demoPill"))}</span> ${esc(cur.label)}`;
        clearBtn.disabled = true;
      }
    }
    $("#search-source-badge").innerHTML =
      `<span class="src-pill ${Masters.kcd().source === "master" ? "master" : "demo"}">${esc(t("search.badgeKcd", { label: Masters.kcd().label }))}</span>
       <span class="src-pill ${Masters.fee().source === "master" ? "master" : "demo"}">${esc(t("search.badgeFee", { label: Masters.fee().label }))}</span>`;
  };

  const renderMapping = (kind) => {
    const box = $(`#master-map-${kind}`);
    const p = pending[kind];
    if (!p) { box.innerHTML = ""; box.hidden = true; return; }
    const spec = Masters.FIELDS[kind];
    const sug = Masters.suggestMapping(kind, p.headers);
    // Keep any mapping the user already picked when re-rendering (language swap).
    const cur = {}; box.querySelectorAll("select[data-field]").forEach(s => { cur[s.dataset.field] = s.value; });
    box.hidden = false;
    box.innerHTML = `
      <div class="map-head">${t("search.mapHead", { file: esc(p.fileName), n: p.rows.length.toLocaleString("ko-KR"), req: esc(spec.required.map(f => spec.fields[f].label).join(", ")) })}</div>
      ${Object.entries(spec.fields).map(([f, def]) => `
        <label class="map-row"><span>${esc(def.label)}${spec.required.includes(f) ? " *" : ""}</span>
          <select data-field="${f}"><option value="">${esc(t("search.mapNone"))}</option>${p.headers.map(h => `<option value="${esc(h)}"${(f in cur ? cur[f] : sug[f]) === h ? " selected" : ""}>${esc(h)}</option>`).join("")}</select>
        </label>`).join("")}
      <div class="map-actions">
        <button type="button" class="btn" data-map-save="${kind}">${esc(t("search.mapSave"))}</button>
        <button type="button" class="btn secondary" data-map-cancel="${kind}">${esc(t("common.cancel"))}</button>
        <span class="map-msg" id="master-map-msg-${kind}"></span>
      </div>`;
    box.querySelector(`[data-map-cancel]`).addEventListener("click", () => { pending[kind] = null; renderMapping(kind); });
    box.querySelector(`[data-map-save]`).addEventListener("click", async () => {
      const mapping = {};
      box.querySelectorAll("select[data-field]").forEach(s => { if (s.value) mapping[s.dataset.field] = s.value; });
      const missing = spec.required.filter(f => !mapping[f]);
      const msg = $(`#master-map-msg-${kind}`);
      if (missing.length) { msg.textContent = t("search.mapMissing", { f: missing.map(f => spec.fields[f].label).join(", ") }); return; }
      const rows = Masters.normalizeRows(kind, p.rows, mapping);
      if (!rows.length) { msg.textContent = t("search.mapNoCodes"); return; }
      try {
        await Masters.put(kind, rows, { fileName: p.fileName, mapping });
        pending[kind] = null; renderMapping(kind);
        ActivityLog.push("search", t("search.logMasterUpload", { label: spec.label, n: rows.length }), { kind });
      } catch (err) {
        console.error(err); msg.textContent = t("search.mapSaveFail");
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
        if (!rows.length) { $(`#master-status-${kind}`).innerHTML = `<span class="pill warn">${esc(t("search.pillEmptyFile"))}</span>`; return; }
        pending[kind] = { fileName: file.name, headers: Object.keys(rows[0]), rows };
        renderMapping(kind);
      } catch (err) {
        console.error(err);
        $(`#master-status-${kind}`).innerHTML = `<span class="pill err">${esc(t("search.pillReadFail"))}</span> ${esc(t("search.readFailHint"))}`;
      } finally { e.target.value = ""; }
    });
    $(`#master-clear-${kind}`).addEventListener("click", async () => {
      await Masters.clear(kind);
      ActivityLog.push("search", t("search.logMasterClear", { label: Masters.FIELDS[kind].label }), { kind });
    });
  }

  Masters.onChange(() => { buildIndex(); renderMasterStatus(); if (input.value.trim()) render(input.value); });
  Masters.ready().then(() => { buildIndex(); renderMasterStatus(); });
  renderMasterStatus();

  onLangChange(() => {
    buildIndex(); renderMasterStatus(); render(input.value);
    for (const kind of ["kcd", "fee"]) if (pending[kind]) renderMapping(kind);
  });
}
