/* clinic-admin — code index + 조직 › 마스터 업로드 panel (#tab-masters).
   The 검색 panel is retired: its results table now lives in the global search overlay (js/global-search.js) and
   uses searchAll() from here, so the masters-aware index has exactly one owner.
     searchAll(query, { source, limit }) → rows      uploaded KOICD 상병 / 심평원 행위·수가 masters when present, else the
                                                     bundled 발췌·예시 tables, with a source badge per row; Hangul 초성 works.
     srcLabel(origin)                                "업로드 마스터" / "데모 발췌" (overlay source pills)
   init() wires the master upload/mapping/status UI in #tab-masters (+ #search-source-badge) and flashes the cards on
   activateTab("tab-masters", { section: "masters" }) — which is also where activateTab("tab-search", { section:
   "masters" }) is routed by nav.js. Rebuilding the index emits `search:index` (local) so the overlay re-renders.
   i18n: bundled rows carry name_en (data/*.json) and uploaded KOICD masters carry the file's 영문명 column, so the
   EN view shows English names where they exist; the index is rebuilt on every language swap. */
import { $, esc, fmtKRW, won, fuzzyMatch } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet } from "../core/files.js";
import { Masters, toEdi } from "../core/masters.js";
import { Tariff } from "../core/entities.js";
import { tariffPrice } from "./claims-shared.js";

/* ── module-level index (shared by the masters panel and searchAll) ── */
let DATA_REF = null;
let all = [];
export const srcLabel = (origin) => t(origin === "master" ? "search.srcMaster" : "search.srcBundled");
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
  EventBus.emitLocal("search:index", all.length);
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

export function seed() { /* the overlay's demo query is a CTA ([data-action=run-search]); nothing to seed for the masters panel */ }

export function init(ctx) {
  const { DATA } = ctx;
  DATA_REF = DATA;
  Masters.init(DATA);
  buildIndex();

  /* ───────────── Master upload (KOICD 상병 / 심평원 행위·수가) — 조직 › 마스터 업로드 ───────────── */
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
    const badge = $("#search-source-badge");
    if (badge) badge.innerHTML =
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

  // Source badges elsewhere (상병 정비 · 심사결과 대조 · overlay) land here: flash the cards so the eye finds them.
  const flashMasters = () => {
    const el = $("#tab-masters .master-upload"); if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };
  EventBus.on("tab:activated", (p) => { if (p?.id === "tab-masters" && p.ctx?.section === "masters") setTimeout(flashMasters, 60); });

  Masters.onChange(() => { buildIndex(); renderMasterStatus(); });
  Masters.ready().then(() => { buildIndex(); renderMasterStatus(); });
  // 우리 단가 (overlay column) follows the shared Tariff entity (비급여 단가표).
  Tariff.onChange(() => buildIndex());
  renderMasterStatus();

  onLangChange(() => {
    buildIndex(); renderMasterStatus();
    for (const kind of ["kcd", "fee"]) if (pending[kind]) renderMapping(kind);
  });
}
