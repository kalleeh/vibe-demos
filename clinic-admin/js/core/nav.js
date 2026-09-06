/* clinic-admin — tab metadata + activateTab (sits below Toast in the import graph so ui.js never depends on shell.js)
   Extracted verbatim from the former single-file index.html; behaviour unchanged.
   i18n: `label` / `section` are getters over the nav.* keys, so the rail, crumb and palette follow the language. */
import { $, $$ } from "./dom.js";
import { t } from "./i18n.js";
import { Store, EventBus } from "./store.js";

/* ─────────────────────────────────────────────────────────
   Tab navigation
   ───────────────────────────────────────────────────────── */
/* Tab metadata used by rail, palette, crumb */
const tab = (id, num, labelKey, sectionKey, glyph) => ({
  id, num, labelKey, sectionKey, glyph,
  get label() { return t(labelKey); },
  get section() { return t(sectionKey); }
});
const TABS = [
  tab("tab-today",     "00", "nav.today",     "nav.sec.start",     "◐"),
  tab("tab-kcd",       "01", "nav.kcd",       "nav.sec.claims",    "K"),
  tab("tab-jabo",      "02", "nav.jabo",      "nav.sec.claims",    "J"),
  tab("tab-search",    "06", "nav.search",    "nav.sec.claims",    "Q"),
  tab("tab-ai",        "07", "nav.ai",        "nav.sec.claims",    "A"),
  tab("tab-yearend",   "03", "nav.yearend",   "nav.sec.reporting", "Y"),
  tab("tab-bigeup",    "04", "nav.bigeup",    "nav.sec.reporting", "B"),
  tab("tab-retention", "05", "nav.retention", "nav.sec.reporting", "R"),
  tab("tab-license",   "08", "nav.license",   "nav.sec.org",       "L"),
  tab("tab-accred",    "09", "nav.accred",    "nav.sec.org",       "C")
];
const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t]));

// Crumb only (no store write / scroll / event) — used by the language toggle.
function refreshCrumb(panelId) {
  const meta = TAB_BY_ID[panelId];
  if (!meta) return;
  const cs = $("#crumb-section"); if (cs) cs.textContent = meta.section;
  const ct = $("#crumb-tab");     if (ct) ct.textContent = meta.label;
}
function activeTabId() { return $(".panel.active")?.id || null; }

function activateTab(panelId) {
  const panel = $("#" + panelId);
  if (!panel) return;
  $$(".rail-btn[data-panel]").forEach(b => b.classList.remove("active"));
  $$(".panel").forEach(p => p.classList.remove("active"));
  $$(`.rail-btn[data-panel="${panelId}"]`).forEach(b => b.classList.add("active"));
  panel.classList.add("active");
  Store.set("ui.activeTab", panelId);
  refreshCrumb(panelId);
  // The body is a locked viewport; the work column is what actually scrolls.
  $("#work-scroll")?.scrollTo({ top: 0 });
  EventBus.emit("tab:activated", panelId);
}
export { TABS, TAB_BY_ID, activateTab, refreshCrumb, activeTabId };
