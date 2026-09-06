/* clinic-admin — Tab 06 · 통합 코드 검색 + 마스터 업로드
   Searches the uploaded masters (KOICD 상병 / 심평원 행위·수가) when present, else the
   bundled 발췌·예시 tables, with a source badge per row. Hosts the master upload/clear UI.
   Palette-ready API: searchAll(query, { source, limit }) → rows (shape below) is exported at module level so the
   ⌘K palette (shell) can reuse the exact same masters-aware index.
   Per row: 우리 단가 (Tariff.get — 비급여 rows, next to the master min~max range) and an 삽입… popover:
   자보 케이스 (→ 02 ctx) · AI 메모 (→ 07 ctx, appended) · 클립보드 (EDI form).
   ctx: activateTab("tab-search", { query }) runs a search · { section: "masters" } scrolls to the upload cards.
   i18n: bundled rows carry name_en (data/*.json) and uploaded KOICD masters carry the file's 영문명 column, so
   the EN view shows English names where they exist; the index is rebuilt on every language swap. */
import { $, $$, esc, fmtKRW, won, todayISO, fuzzyMatch, Toast } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";
import { Masters, toEdi } from "../core/masters.js";
import { activateTab } from "./_entities-shim-claims.js"; // TODO(integrator): ../core/nav.js
import { tariffPrice } from "./claims-shared.js";

/* ── module-level index (shared by the tab UI and searchAll) ── */
let DATA_REF = null;
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

function buildIndex() {
  const k = Masters.kcd(), f = Masters.fee();
  const bigeup = DATA_REF?.bigeup?.items || [];
  all = [
    ...k.rows.map(m => ({
      source: "kcd", source_label: "KCD", origin: k.source, code: m.code, edi: m.edi || toEdi(m.code), alt_code: m.edi && m.edi !== m.code ? m.edi : "",
      name: pick(m, "name"), name_alt: m.name_en || "", name_ko: m.name, category: catOf("kcd", m.category) || (m.complete === false ? t("search.parentClass") : ""), extra: pick(m, "name") === m.name ? (m.name_en || "") : m.name, flags: [], ref_date: k.date, tariff: null
    })),
    ...f.rows.map(it => ({
      source: "jabo", source_label: f.source === "master" ? t("search.lblFee") : t("search.lblFeeExample"), origin: f.source, code: it.code, edi: it.code, alt_code: "",
      name: pick(it, "name"), name_alt: it.name_en || "", name_ko: it.name, category: catOf("jabo", it.category), extra: it.price == null ? (pick(it, "note") || "") : `${won(it.price)} / ${unitLabel(it.unit)}`, flags: flagsOf(it), ref_date: f.date, tariff: null
    })),
    ...bigeup.map(it => ({
      source: "bigeup", source_label: t("common.bigeup"), origin: "bundled", code: it.code, edi: it.code, alt_code: "",
      name: pick(it, "name"), name_alt: it.name_en || "", name_ko: it.name, category: catOf("bigeup", it.category), extra: `${fmtKRW(it.min)}~${won(it.max)} / ${unitLabel(it.unit)}`, flags: [[t("search.flag.noncovered"), "warn"]], ref_date: DATA_REF?.bigeup?.effective_date || "", tariff: tariffPrice(it.code)
    }))
  ];
}
const matches = (q, item) =>
  fuzzyMatch(item.name_ko || "", q) || fuzzyMatch(item.name_alt || "", q) || fuzzyMatch(item.code, q) ||
  (item.alt_code && fuzzyMatch(item.alt_code, q)) || fuzzyMatch(item.category || "", q);

/* searchAll(query, { source = "all" | "kcd" | "jabo" | "bigeup", limit = 200 }) → row[]
   row = { source, source_label, origin: "master" | "bundled", code, edi, alt_code, name (UI language), name_ko, name_alt (EN),
           category (UI language), extra (price / range / gloss), flags: [[text, cls]], ref_date, tariff: number | null }
   Masters-aware: uploaded KOICD / 심평원 masters replace the bundled 발췌·예시 rows. Hangul 초성 queries work (fuzzyMatch). */
export function searchAll(query, { source = "all", limit = 200 } = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  if (!all.length) buildIndex();
  return all.filter(it => source === "all" || it.source === source).filter(it => matches(q, it)).slice(0, limit);
}

let seedFn = null;
export function seed() { return seedFn ? seedFn() : Promise.resolve(); }

export function initTab6(ctx) {
  const { DATA } = ctx;
  DATA_REF = DATA;
  Masters.init(DATA);
  let activeFilter = "all";
  let lastResults = [];
  let openInsert = -1;
  buildIndex();

  const insertRow = (r, i) => {
    const opts = [];
    if (r.source === "kcd") opts.push(`<button type="button" class="row-act" data-ins="jabo-dx" data-i="${i}">${esc(t("search.insertJaboDx"))}</button>`);
    if (r.source === "jabo") opts.push(`<button type="button" class="row-act" data-ins="jabo-item" data-i="${i}">${esc(t("search.insertJaboItem"))}</button>`);
    opts.push(`<button type="button" class="row-act" data-ins="ai" data-i="${i}">${esc(t("search.insertAi"))}</button>`);
    opts.push(`<button type="button" class="row-act" data-ins="clip" data-i="${i}">${esc(t("search.insertClip", { code: r.edi || r.code }))}</button>`);
    return `<tr class="insert-row"><td colspan="10"><span class="insert-label">${esc(t("search.insertLabel", { code: r.code }))}</span> ${opts.join(" ")}</td></tr>`;
  };

  const render = (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      $("#search-result").innerHTML = `<div class="empty-state">${esc(t("search.empty"))}</div>`;
      $("#search-summary").textContent = t("search.summaryIdle");
      $("#search-download").disabled = true;
      lastResults = []; openInsert = -1;
      return;
    }
    const results = searchAll(trimmed, { source: activeFilter });
    lastResults = results;
    $("#search-summary").innerHTML = t("search.summary", { n: results.length, q: esc(trimmed), scope: activeFilter === "all" ? esc(t("search.filterAll")) : esc(results[0]?.source_label || "—") });
    $("#search-download").disabled = results.length === 0;
    if (!results.length) { $("#search-result").innerHTML = `<div class="empty-state">${esc(t("search.noResults"))}</div>`; return; }
    $("#search-result").innerHTML = `
      <table>
        <thead><tr>
          <th>${esc(t("search.thKind"))}</th><th class="code">${esc(t("jabo.thCodeShort"))}</th><th>${esc(t("search.thName"))}</th><th>${esc(t("common.thCategory"))}</th><th>${esc(t("search.thCoverage"))}</th><th>${esc(t("search.thExtra"))}</th><th class="code">${esc(t("search.thTariff"))}</th><th>${esc(t("search.thSource"))}</th><th class="code">${esc(t("search.thRefDate"))}</th><th>${esc(t("search.thActions"))}</th>
        </tr></thead>
        <tbody>
          ${results.map((r, i) => {
            const sourceCls = r.source === "kcd" ? "info" : r.source === "jabo" ? "warn" : "ok";
            return `<tr class="${openInsert === i ? "insert-open" : ""}">
              <td><span class="pill ${sourceCls}">${esc(r.source_label)}</span></td>
              <td class="code">${esc(r.code)}${r.alt_code ? `<br><span style="color:var(--faint); font-size:10px">EDI ${esc(r.alt_code)}</span>` : ""}</td>
              <td>${esc(r.name)}</td><td>${esc(r.category) || "—"}</td>
              <td>${r.flags.length ? r.flags.map(([tx, c]) => `<span class="pill ${c}">${esc(tx)}</span>`).join(" ") : "—"}</td>
              <td>${esc(r.extra) || "—"}</td>
              <td class="code tariff">${r.tariff != null ? `<strong>${esc(won(r.tariff))}</strong>` : (r.source === "bigeup" ? `<span class="faint">${esc(t("search.tariffNone"))}</span>` : "—")}</td>
              <td><button type="button" class="src-pill clickable ${r.origin === "master" ? "master" : "demo"}" data-masters title="${esc(t("search.gotoMastersTitle"))}">${esc(srcLabel(r.origin))}</button></td>
              <td class="code" style="color:var(--muted)">${esc(r.ref_date) || "—"}</td>
              <td class="actions"><button type="button" class="row-act" data-insert="${i}" aria-expanded="${openInsert === i}">${esc(t("search.insert"))}</button></td>
            </tr>${openInsert === i ? insertRow(r, i) : ""}`;
          }).join("")}
        </tbody>
      </table>`;
    const box = $("#search-result");
    box.querySelectorAll("button[data-insert]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.insert; openInsert = openInsert === i ? -1 : i; render(input.value); }));
    box.querySelectorAll("button[data-masters]").forEach(b => b.addEventListener("click", gotoMasters));
    box.querySelectorAll("button[data-ins]").forEach(b => b.addEventListener("click", async () => {
      const r = lastResults[+b.dataset.i]; if (!r) return;
      const kind = b.dataset.ins;
      if (kind === "jabo-dx") { ActivityLog.push("search", t("search.logInsert", { code: r.code, where: t("nav.jabo") }), {}); activateTab("tab-jabo", { dx: r.edi }); }
      else if (kind === "jabo-item") { ActivityLog.push("search", t("search.logInsert", { code: r.code, where: t("nav.jabo") }), {}); activateTab("tab-jabo", { items: [r.code] }); }
      else if (kind === "ai") { activateTab("tab-ai", { prefill: `${r.code} ${r.name_ko || r.name}`, append: true }); }
      else if (kind === "clip") {
        try { await navigator.clipboard.writeText(r.edi || r.code); Toast.show({ tag: "search", html: esc(t("common.copied")) }); }
        catch { Toast.show({ tag: "search", html: esc(t("common.shareFailed")) }); }
      }
      openInsert = -1; render(input.value);
    }));
  };

  const input = $("#search-input");
  let debounceT;
  input.addEventListener("input", e => { clearTimeout(debounceT); openInsert = -1; debounceT = setTimeout(() => render(e.target.value), 80); });
  $$(".filter-chip").forEach(chip => chip.addEventListener("click", () => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.source; openInsert = -1;
    render(input.value);
  }));

  $("#search-download").addEventListener("click", () => {
    if (!lastResults.length) return;
    const rows = lastResults.map(r => headerRow([
      ["search.col.kind", r.source_label], ["search.col.code", r.code], ["search.col.edi", r.alt_code], ["search.col.name", r.name], ["search.col.cat", r.category],
      ["search.col.coverage", r.flags.map(f => f[0]).join(" ")], ["common.thNote", r.extra], ["search.col.tariff", r.tariff ?? ""], ["search.col.source", srcLabel(r.origin)], ["search.col.refDate", r.ref_date]
    ]));
    downloadXLSX(rows, t("search.file", { q: input.value.trim(), date: todayISO() }), t("search.sheet"));
  });

  const goSearch = (q) => {
    $$(".filter-chip").forEach(c => c.classList.remove("active"));
    $('.filter-chip[data-source="all"]').classList.add("active");
    activeFilter = "all"; openInsert = -1;
    input.value = q; input.focus(); render(q);
    $("#work-scroll")?.scrollTo({ top: 0 });
  };
  const gotoMasters = () => {
    const el = $("#tab-search .master-upload"); if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };
  seedFn = async () => { goSearch("요통"); ActivityLog.push("search", t("search.logDemo"), {}); };
  $('[data-action="run-search"]').addEventListener("click", () => { seedFn(); });
  EventBus.on("search:query", (q) => { if (!q) return; activateTab("tab-search"); goSearch(q); });
  EventBus.on("tab:activated", (p) => {
    const id = typeof p === "string" ? p : p?.id; const c = typeof p === "string" ? null : p?.ctx;
    if (id !== "tab-search" || !c) return;
    if (c.query) goSearch(String(c.query));
    if (c.section === "masters") setTimeout(gotoMasters, 60);
  });

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
  // 우리 단가 follows tab 04's 비급여 단가표.
  EventBus.on("store:bigeup.tariff", () => { buildIndex(); if (input.value.trim()) render(input.value); });
  renderMasterStatus();

  onLangChange(() => {
    buildIndex(); renderMasterStatus(); render(input.value);
    for (const kind of ["kcd", "fee"]) if (pending[kind]) renderMapping(kind);
  });
}
