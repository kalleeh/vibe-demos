/* clinic-admin — tab metadata + activateTab (sits below Toast in the import graph so ui.js never depends on shell.js)
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, $$ } from "./dom.js";
import { Store, EventBus } from "./store.js";

/* ─────────────────────────────────────────────────────────
   Tab navigation
   ───────────────────────────────────────────────────────── */
/* Tab metadata used by rail, palette, crumb */
const TABS = [
  { id: "tab-today",     num: "00", label: "오늘",                section: "시작",      glyph: "◐" },
  { id: "tab-kcd",       num: "01", label: "KCD-8 정비",          section: "청구·코드", glyph: "K" },
  { id: "tab-jabo",      num: "02", label: "자보 정산",            section: "청구·코드", glyph: "J" },
  { id: "tab-search",    num: "06", label: "코드 검색",            section: "청구·코드", glyph: "Q" },
  { id: "tab-ai",        num: "07", label: "AI 코딩 어시스트",     section: "청구·코드", glyph: "A" },
  { id: "tab-yearend",   num: "03", label: "연말정산 검증",         section: "보고·감사", glyph: "Y" },
  { id: "tab-bigeup",    num: "04", label: "비급여 반기보고",       section: "보고·감사", glyph: "B" },
  { id: "tab-retention", num: "05", label: "보존 감사",            section: "보고·감사", glyph: "R" },
  { id: "tab-license",   num: "08", label: "면허·자격 갱신",       section: "조직·인증", glyph: "L" },
  { id: "tab-accred",    num: "09", label: "인증평가",             section: "조직·인증", glyph: "C" }
];
const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t]));

function activateTab(panelId) {
  const panel = $("#" + panelId);
  if (!panel) return;
  $$(".rail-btn[data-panel]").forEach(b => b.classList.remove("active"));
  $$(".panel").forEach(p => p.classList.remove("active"));
  $$(`.rail-btn[data-panel="${panelId}"]`).forEach(b => b.classList.add("active"));
  panel.classList.add("active");
  Store.set("ui.activeTab", panelId);
  const meta = TAB_BY_ID[panelId];
  if (meta) {
    const cs = $("#crumb-section"); if (cs) cs.textContent = meta.section;
    const ct = $("#crumb-tab");     if (ct) ct.textContent = meta.label;
  }
  // The body is a locked viewport; the work column is what actually scrolls.
  $("#work-scroll")?.scrollTo({ top: 0 });
  EventBus.emit("tab:activated", panelId);
}
export { TABS, TAB_BY_ID, activateTab };
