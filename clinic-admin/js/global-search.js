/* clinic-admin — global search (⌘K / Ctrl+K · topbar 🔍) — the former command palette merged with the retired 검색 panel.
   ONE input, two groups:
     이동 · 명령   panels (nav.js TABS, no numbers), the AI utility, the shell's demo commands, saved 자보 cases,
                  roster rows, accreditation items — arrow keys + Enter, exactly the palette behaviour.
     코드          searchAll() from js/tabs/tab6-search.js (uploaded KOICD / 심평원 masters when present, else the
                  bundled 발췌·예시) rendered as the old results table: 우리 단가 column, source badge (→ 조직 › 마스터),
                  filter chips, XLSX download and the 삽입… popover (자보 케이스 주상병 / 행위 · AI 메모 · 클립보드).
   Utility contract: registerUtility("tab-search") — activateTab("tab-search", { query }) from any tab opens the overlay
   prefilled; `search:query` on the EventBus does the same. Phone: the overlay is a full-screen sheet.
   The shell passes its command list (seed · tour · lock · users · privacy · wipe · language · AI) through
   initGlobalSearch({ commands }); everything else is resolved here. */
import { $, $$, esc, won, todayISO, Toast, Dialog, redactSubject } from "./core/ui.js";
import { t, onLangChange } from "./core/i18n.js";
import { Store, EventBus, ActivityLog } from "./core/store.js";
import { downloadXLSX, headerRow } from "./core/files.js";
import { TABS, UTILITIES, activateTab, registerUtility } from "./core/nav.js";
import { Staff } from "./core/entities.js";
import { searchAll, srcLabel } from "./tabs/tab6-search.js";
import { ACCRED_ITEMS, accredText } from "./tabs/tab9-accred.js";

const KINDS = ["go", "cmd", "jabo", "license", "accred"];
const SHOW_MAX = 60;   // rows rendered in the overlay table
const FETCH_MAX = 400; // rows searched / exported

export function initGlobalSearch({ commands = () => [] } = {}) {
  const scrim = $("#search-scrim");
  const input = $("#search-input");
  const navBox = $("#search-nav-results");
  const codesBox = $("#search-result");
  const summary = $("#search-summary");
  const dlBtn = $("#search-download");
  if (!scrim || !input) return { open() {}, close() {}, refresh() {}, isOpen: () => false };

  let items = [];          // 이동·명령 rows
  let sel = 0;
  let results = [];        // code rows (full fetch)
  let activeFilter = "all";
  let openInsert = -1;
  const kindLabel = (k) => t("shell.pal.kind." + k);
  const isOpen = () => Dialog.isOpen(scrim);

  /* ── 이동 · 명령 ── */
  function buildNav(q) {
    const out = [];
    for (const tb of TABS) {
      if (!q || tb.label.toLowerCase().includes(q) || tb.section.toLowerCase().includes(q)) {
        out.push({ kind: "go", glyph: tb.glyph, label: tb.label, meta: tb.section, run: () => activateTab(tb.id) });
      }
    }
    const ai = UTILITIES["tab-ai"];
    if (!q || ai.label.toLowerCase().includes(q) || "ai".includes(q)) out.push({ kind: "go", glyph: ai.glyph, label: ai.label, meta: t("shell.pal.utility"), run: () => activateTab("tab-ai") });
    for (const c of commands()) {
      if (!q || c.label.toLowerCase().includes(q) || (c.meta || "").toLowerCase().includes(q)) out.push({ kind: "cmd", ...c });
    }
    // Saved 자보 cases — file reconciliations by 명세서 count, manual cases pseudonymised (****1234); never a name
    const jhist = Store.get("jabo.history", []) || [];
    for (const j of jhist.slice(0, 8)) {
      const cap = j.kind === "recon" ? t("shell.pal.reconCap", { n: j.stmts || 0 }) : `${redactSubject({ name: j.name, pid: j.pid })} · ${j.insurer || "—"}`;
      if (!q || cap.toLowerCase().includes(q)) out.push({ kind: "jabo", glyph: "J", label: cap, meta: t("shell.pal.jaboMeta", { date: j.date || "", n: j.itemCount || 0 }), run: () => activateTab("tab-jabo") });
    }
    // Staff roster — pseudonymised (한의사 윤○○); 원무·행정·기타 carry no 신고 duty, so no deadline. Lands on the row.
    for (const s of Staff.list()) {
      const cap = Staff.ref(s);
      if (!q || cap.toLowerCase().includes(q)) out.push({ kind: "license", glyph: "L", label: cap, meta: Staff.hasDuty(s.job) ? t("license.dueMeta", { d: s.expiry || "—" }) : t("license.noDuty"), run: () => activateTab("tab-license", { staffId: s.id }) });
    }
    if (q && q.length >= 2) {
      for (const cat of ACCRED_ITEMS) for (const it of cat.items) {
        const label = accredText(it, "label");
        if (label.toLowerCase().includes(q) || it.label.toLowerCase().includes(q)) out.push({ kind: "accred", glyph: "C", label, meta: accredText(cat, "title"), run: () => activateTab("tab-accred", { itemId: it.id }) });
      }
    }
    return out.slice(0, 40);
  }
  function renderNav() {
    if (!items.length) {
      navBox.innerHTML = `<div class="palette-empty">${esc(t("shell.pal.empty"))}</div>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    const groups = {};
    items.forEach((it, i) => { (groups[it.kind] = groups[it.kind] || []).push({ it, i }); });
    let html = "";
    for (const k of KINDS) {
      if (!groups[k]) continue;
      html += `<div class="palette-section-label">${esc(kindLabel(k))}</div>`;
      for (const { it, i } of groups[k]) {
        html += `<div class="palette-item ${i === sel ? "sel" : ""}" data-i="${i}" id="search-opt-${i}" role="option" aria-selected="${i === sel}">
          <span class="glyph">${it.glyph || "·"}</span>
          <span class="label">${esc(it.label)}${it.meta ? `<span class="meta">${esc(it.meta)}</span>` : ""}</span>
          <span class="kind">${esc(kindLabel(it.kind))}</span>
        </div>`;
      }
    }
    navBox.innerHTML = html;
    navBox.querySelectorAll(".palette-item").forEach(el => el.addEventListener("click", () => run(parseInt(el.dataset.i, 10))));
    const selEl = navBox.querySelector(".palette-item.sel");
    if (selEl) { selEl.scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", selEl.id); }
  }
  function run(i) {
    const it = items[i];
    if (!it) return;
    close();
    try { it.run(); } catch (e) { console.error(e); }
  }

  /* ── 코드 (the old 06 results table) ── */
  const insertRow = (r, i) => {
    const opts = [];
    if (r.source === "kcd") opts.push(`<button type="button" class="row-act" data-ins="jabo-dx" data-i="${i}">${esc(t("search.insertJaboDx"))}</button>`);
    if (r.source === "jabo") opts.push(`<button type="button" class="row-act" data-ins="jabo-item" data-i="${i}">${esc(t("search.insertJaboItem"))}</button>`);
    opts.push(`<button type="button" class="row-act" data-ins="ai" data-i="${i}">${esc(t("search.insertAi"))}</button>`);
    opts.push(`<button type="button" class="row-act" data-ins="clip" data-i="${i}">${esc(t("search.insertClip", { code: r.edi || r.code }))}</button>`);
    return `<tr class="insert-row"><td colspan="10"><span class="insert-label">${esc(t("search.insertLabel", { code: r.code }))}</span> ${opts.join(" ")}</td></tr>`;
  };
  function renderCodes(q) {
    if (!q) {
      results = []; openInsert = -1;
      codesBox.innerHTML = `<div class="empty">${esc(t("search.empty"))}</div>`;
      summary.textContent = t("search.summaryIdle");
      dlBtn.disabled = true;
      return;
    }
    results = searchAll(q, { source: activeFilter, limit: FETCH_MAX });
    const shown = results.slice(0, SHOW_MAX);
    summary.innerHTML = t("search.summary", { n: results.length, q: esc(q), scope: activeFilter === "all" ? esc(t("search.filterAll")) : esc(results[0]?.source_label || "—") })
      + (results.length > SHOW_MAX ? ` · ${esc(t("search.shownMax", { n: SHOW_MAX }))}` : "");
    dlBtn.disabled = results.length === 0;
    if (!results.length) { codesBox.innerHTML = `<div class="empty">${esc(t("search.noResults"))}</div>`; return; }
    codesBox.innerHTML = `
      <table>
        <thead><tr>
          <th>${esc(t("search.thKind"))}</th><th class="code">${esc(t("jabo.thCodeShort"))}</th><th>${esc(t("search.thName"))}</th><th>${esc(t("common.thCategory"))}</th><th>${esc(t("search.thCoverage"))}</th><th>${esc(t("search.thExtra"))}</th><th class="code">${esc(t("search.thTariff"))}</th><th>${esc(t("search.thSource"))}</th><th class="code">${esc(t("search.thRefDate"))}</th><th>${esc(t("search.thActions"))}</th>
        </tr></thead>
        <tbody>
          ${shown.map((r, i) => {
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
    codesBox.querySelectorAll("button[data-insert]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.insert; openInsert = openInsert === i ? -1 : i; renderCodes(input.value.trim()); }));
    codesBox.querySelectorAll("button[data-masters]").forEach(b => b.addEventListener("click", () => { close(); activateTab("tab-masters", { section: "masters" }); }));
    codesBox.querySelectorAll("button[data-ins]").forEach(b => b.addEventListener("click", async () => {
      const r = results[+b.dataset.i]; if (!r) return;
      const kind = b.dataset.ins;
      if (kind === "jabo-dx") { close(); ActivityLog.push("search", t("search.logInsert", { code: r.code, where: t("nav.jabo") }), {}); activateTab("tab-jabo", { dx: r.edi }); return; }
      if (kind === "jabo-item") { close(); ActivityLog.push("search", t("search.logInsert", { code: r.code, where: t("nav.jabo") }), {}); activateTab("tab-jabo", { items: [r.code] }); return; }
      if (kind === "ai") { close(); activateTab("tab-ai", { prefill: `${r.code} ${r.name_ko || r.name}`, append: true }); return; }
      if (kind === "clip") {
        try { await navigator.clipboard.writeText(r.edi || r.code); Toast.show({ tag: "search", html: esc(t("common.copied")) }); }
        catch { Toast.show({ tag: "search", html: esc(t("common.shareFailed")) }); }
      }
      openInsert = -1; renderCodes(input.value.trim());
    }));
  }
  $$("#search-scrim .filter-chip").forEach(chip => chip.addEventListener("click", () => {
    $$("#search-scrim .filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.source; openInsert = -1;
    renderCodes(input.value.trim());
    input.focus();
  }));
  dlBtn.addEventListener("click", () => {
    if (!results.length) return;
    const rows = results.map(r => headerRow([
      ["search.col.kind", r.source_label], ["search.col.code", r.code], ["search.col.edi", r.alt_code], ["search.col.name", r.name], ["search.col.cat", r.category],
      ["search.col.coverage", r.flags.map(f => f[0]).join(" ")], ["common.thNote", r.extra], ["search.col.tariff", r.tariff ?? ""], ["search.col.source", srcLabel(r.origin)], ["search.col.refDate", r.ref_date]
    ]));
    downloadXLSX(rows, t("search.file", { q: input.value.trim(), date: todayISO() }), t("search.sheet"));
  });

  /* ── overlay ── */
  function refresh() {
    const raw = input.value; const q = raw.trim();
    items = buildNav(q.toLowerCase());
    if (sel >= items.length) sel = 0;
    renderNav();
    renderCodes(q);
    scrim.classList.toggle("has-query", !!q);
  }
  function open({ query } = {}) {
    if (!isOpen()) Dialog.open(scrim, input);
    input.value = query ? String(query) : "";
    sel = 0; openInsert = -1;
    if (query) { $$("#search-scrim .filter-chip").forEach(c => c.classList.toggle("active", c.dataset.source === "all")); activeFilter = "all"; }
    refresh();
    setTimeout(() => { input.focus(); if (query) input.select(); }, 40);
  }
  function close() { Dialog.close(scrim); }
  let debounceT;
  input.addEventListener("input", () => { sel = 0; openInsert = -1; clearTimeout(debounceT); debounceT = setTimeout(refresh, 60); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); renderNav(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); renderNav(); }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  scrim.addEventListener("click", e => { if (e.target.id === "search-scrim") close(); });
  $("#search-close")?.addEventListener("click", close);
  document.addEventListener("keydown", e => {
    const isK = (e.key === "k" || e.key === "K");
    if (isK && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (document.body.classList.contains("locked")) return;
      if (isOpen()) close(); else open();
    }
  });
  // Demo CTA (hidden strip contract): "예시 검색어로 시연" → 요통 across all three sources.
  $('[data-action="run-search"]')?.addEventListener("click", () => { open({ query: "요통" }); ActivityLog.push("search", t("search.logDemo"), {}); });
  registerUtility("tab-search", (ctx) => open({ query: ctx?.query }));
  EventBus.on("search:query", (q) => { if (q) open({ query: q }); });
  EventBus.on("search:index", () => { if (isOpen()) renderCodes(input.value.trim()); });
  onLangChange(() => { if (isOpen()) refresh(); });
  return { open, close, refresh, isOpen };
}
