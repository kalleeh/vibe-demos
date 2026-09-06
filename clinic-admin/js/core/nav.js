/* clinic-admin — information architecture: AREAS → panels (TABS) + the two global utilities, and activateTab.
   Sits below Toast in the import graph so ui.js never depends on shell.js.

   FIVE AREAS (Phase 2 IA — no numbers anywhere):
     home      홈           tab-today
     patients  환자         tab-board                      (Phase 3 adds 지불보증 · 발급 대장 · 비급여 동의 here)
     claims    청구         tab-claims → tab-kcd → tab-jabo (Phase 3 adds 이의신청 as the 3rd step)
     records   보고·기록    tab-yearend · tab-bigeup · tab-retention
     org       조직         tab-org · tab-license · tab-accred · tab-privacy · tab-masters
   UTILITIES (not areas — a global overlay / a right-side drawer, reachable from every panel):
     tab-search  검색 overlay (⌘K)   activateTab("tab-search", { query }) opens it prefilled;
                                      { section: "masters" } is ROUTED to the tab-masters panel.
     tab-ai      AI 드로어            activateTab("tab-ai", ctx) opens the drawer, then emits tab:activated { id: "tab-ai", ctx }
                                      exactly like a panel — js/tabs/tab7-ai.js keeps working unchanged.
   The shell registers the two openers with registerUtility(id, fn) (nav.js cannot import shell.js).

   i18n: `label` / `section` are getters over the nav.* keys, so the rail, crumb and overlay follow the language. */
import { $, $$ } from "./dom.js";
import { t } from "./i18n.js";
import { Store, EventBus } from "./store.js";

const area = (id, labelKey) => ({ id, labelKey, get label() { return t(labelKey); } });
const AREAS = [
  area("home",     "nav.area.home"),
  area("patients", "nav.area.patients"),
  area("claims",   "nav.area.claims"),
  area("records",  "nav.area.records"),
  area("org",      "nav.area.org")
];
const AREA_BY_ID = Object.fromEntries(AREAS.map(a => [a.id, a]));

/* Panel metadata used by the rail, the phone sub-nav, the crumb and the search overlay. `order` = position in its area. */
const tab = (id, areaId, order, labelKey, glyph) => ({
  id, area: areaId, order, labelKey, glyph,
  get label() { return t(labelKey); },
  get section() { return AREA_BY_ID[areaId].label; }
});
const TABS = [
  tab("tab-today",     "home",     0, "nav.today",     "◐"),
  tab("tab-board",     "patients", 0, "nav.board",     "▥"),
  tab("tab-claims",    "claims",   0, "nav.claims",    "▤"),
  tab("tab-kcd",       "claims",   1, "nav.kcd",       "K"),
  tab("tab-jabo",      "claims",   2, "nav.jabo",      "J"),
  tab("tab-yearend",   "records",  0, "nav.yearend",   "Y"),
  tab("tab-bigeup",    "records",  1, "nav.bigeup",    "B"),
  tab("tab-retention", "records",  2, "nav.retention", "R"),
  tab("tab-org",       "org",      0, "nav.org",       "O"),
  tab("tab-license",   "org",      1, "nav.license",   "L"),
  tab("tab-accred",    "org",      2, "nav.accred",    "C"),
  tab("tab-privacy",   "org",      3, "nav.privacy",   "▤"),
  tab("tab-masters",   "org",      4, "nav.masters",   "M")
];
const TAB_BY_ID = Object.fromEntries(TABS.map(x => [x.id, x]));
const panelsOf = (areaId) => TABS.filter(x => x.area === areaId).sort((a, b) => a.order - b.order);

/* Utilities — ids kept for every old caller (activateTab("tab-search", …) / activateTab("tab-ai", …)). */
const UTILITIES = {
  "tab-search": { id: "tab-search", labelKey: "nav.search", glyph: "⌕", get label() { return t("nav.search"); } },
  "tab-ai":     { id: "tab-ai",     labelKey: "nav.ai",     glyph: "✦", get label() { return t("nav.ai"); } }
};
const openers = {};
function registerUtility(id, open) { if (UTILITIES[id]) openers[id] = open; }
const isNavTarget = (id) => !!(TAB_BY_ID[id] || UTILITIES[id]);

// Crumb only (no store write / scroll / event) — used by the language toggle. `area › panel`.
function refreshCrumb(panelId) {
  const meta = TAB_BY_ID[panelId];
  if (!meta) return;
  const cs = $("#crumb-section"); if (cs) cs.textContent = meta.section;
  const ct = $("#crumb-tab");     if (ct) ct.textContent = meta.label;
}
function activeTabId() { return $(".panel.active")?.id || null; }
function activeAreaId() { const id = activeTabId(); return id ? TAB_BY_ID[id]?.area || null : null; }

// Last panel visited per area — clicking an area returns you to where you were inside it.
const lastInArea = {};

/* activateTab(id, ctx?) — ctx is an optional plain object handed to the target so it can land on the right thing:
     { refMonth: "2026-09" } (비급여 window) · { taxYear: 2025 } (연말정산) · { staffId } (roster row) · { stmt } (a 명세서)
     · { itemId } (accred item) · { query } (search overlay) · { prefill, pid, stmt, append } (AI drawer)
     · { section: "masters" } (routed to tab-masters) · { section: "legal" } (privacy pane) · { focus: "manual" } (자보 수기).
   Emitted LOCALLY as `tab:activated` { id, ctx } — ctx may carry a pid, so it never crosses the BroadcastChannel.
   Also activates the panel's AREA (rail group, bottom bar, sub-nav) and updates the crumb. */
function activateTab(panelId, ctx) {
  const payload = ctx && typeof ctx === "object" ? { ...ctx } : null;
  if (panelId === "tab-search" && payload?.section === "masters") panelId = "tab-masters"; // the upload cards moved to 조직 › 마스터
  if (UTILITIES[panelId]) {
    openers[panelId]?.(payload);
    EventBus.emitLocal("tab:activated", { id: panelId, ctx: payload });
    return;
  }
  const meta = TAB_BY_ID[panelId];
  const panel = $("#" + panelId);
  if (!panel || !meta) return;
  $$(".panel").forEach(p => p.classList.remove("active"));
  panel.classList.add("active");
  $$("[data-panel]").forEach(b => b.classList.toggle("active", b.dataset.panel === panelId));
  $$(".area-btn[data-area], .area-panels[data-area], .area[data-area]").forEach(b => b.classList.toggle("active", b.dataset.area === meta.area));
  document.body.dataset.area = meta.area;
  lastInArea[meta.area] = panelId;
  Store.set("ui.activeTab", panelId);
  refreshCrumb(panelId);
  // The body is a locked viewport; the work column is what actually scrolls.
  $("#work-scroll")?.scrollTo({ top: 0 });
  EventBus.emitLocal("tab:activated", { id: panelId, ctx: payload });
}
/* activateArea(id) — the area button: back to the last panel visited in that area, else its first panel. */
function activateArea(areaId) {
  if (!AREA_BY_ID[areaId]) return;
  const list = panelsOf(areaId);
  const target = lastInArea[areaId] && TAB_BY_ID[lastInArea[areaId]]?.area === areaId ? lastInArea[areaId] : list[0]?.id;
  if (target) activateTab(target);
}
/* cyclePanel(±1) — `[` / `]`: previous / next panel inside the current area (wraps). */
function cyclePanel(dir) {
  const cur = activeTabId(); const meta = cur && TAB_BY_ID[cur];
  if (!meta) return;
  const list = panelsOf(meta.area);
  if (list.length < 2) return;
  const i = list.findIndex(x => x.id === cur);
  activateTab(list[(i + (dir < 0 ? -1 : 1) + list.length) % list.length].id);
}
export { AREAS, AREA_BY_ID, TABS, TAB_BY_ID, UTILITIES, panelsOf, registerUtility, isNavTarget, activateTab, activateArea, cyclePanel, refreshCrumb, activeTabId, activeAreaId };
