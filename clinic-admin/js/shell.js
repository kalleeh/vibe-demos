/* clinic-admin — app chrome — five-area rail / phone bottom bar + sub-nav / ⋯ sheet, tab restore, keyboard shortcuts,
   AI drawer (utility), global search (utility · js/global-search.js), 전체 파기, welcome/info/install modals, seed-all,
   topbar due chip, data boot.
   Security pass: the lock screen (js/security/lockscreen.js) is initialised here and boot() waits for the
   first unlock before loading data / initialising tabs, so tabs never see a locked Store at init.
   i18n: the KO|EN toggles (lock card, topbar, ⋯ sheet) all route through setLang(); the shell's onLangChange
   listener is registered at import time — before any tab's — so it runs first: it re-paints the crumb, sub-nav,
   search overlay and topbar chips, then emits `lang:changed` on the EventBus for anything else.
   IA (Phase 2): panels live in AREAS (core/nav.js). Clicking an area lands on its last-visited panel; `[` `]` cycle
   panels inside the area, `1`–`5` jump areas (never while typing). 검색 and AI are utilities: the overlay opens on
   ⌘K / the topbar 🔍, the drawer on the topbar ✦ and every "AI에게 묻기" action (activateTab("tab-ai", ctx)). */
import { $, $$, esc, Toast, Dialog, Lightbox } from "./core/ui.js";
import { t, getLang, setLang, onLangChange, isEn } from "./core/i18n.js";
import { Store, EventBus, ActivityLog, SyncStatus } from "./core/store.js";
import { AREAS, TAB_BY_ID, panelsOf, activateTab, activateArea, cyclePanel, refreshCrumb, activeTabId, registerUtility } from "./core/nav.js";
import { loadJSON } from "./core/files.js";
import { allDeadlines } from "./core/calendar.js";
import { Org, Staff, Patients, Insurers } from "./core/entities.js";
import { renderOrgForm } from "./core/org-form.js";
import { Session } from "./security/session.js";
import { destroyAll } from "./security/lifecycle.js";
import { initSecurityUI, Lock, UsersPanel, PrivacyPanel, isDestroyWord } from "./security/lockscreen.js";
import { renderOrgReadOnly } from "./tabs/reporting-shared.js";
import { initGlobalSearch } from "./global-search.js";

const PHONE = () => window.innerWidth <= 880;

/* Language toggle — one delegated handler for every .lang-toggle (lock card, topbar, ⋯ sheet). The lock card
   sits outside the inert shell, so it stays clickable while locked. */
document.addEventListener("click", (e) => {
  const b = e.target.closest?.(".lang-toggle button[data-lang]");
  if (b) setLang(b.dataset.lang);
});
onLangChange(() => {
  const id = activeTabId(); if (id) refreshCrumb(id);
  renderSubnav();
  SyncStatus.refresh();
  EventBus.emitLocal("lang:changed", getLang());
});

/* Lock screen first — it covers the shell until a PIN unlocks the workspace (or one is created). */
const sessionReady = initSecurityUI();

/* ─────────────────────────────────────────────────────────
   Navigation chrome — areas (rail + bottom bar), panels (rail sub-list + phone sub-nav), last-tab restore
   ───────────────────────────────────────────────────────── */
document.addEventListener("click", (e) => {
  const a = e.target.closest?.(".area-btn[data-area]");
  if (a) { activateArea(a.dataset.area); return; }
  const p = e.target.closest?.("#rail-areas [data-panel], #subnav [data-panel]");
  if (p) activateTab(p.dataset.panel);
});
/* Phone sub-nav: the active area's panels as a segmented control (hidden when the area has a single panel). */
function renderSubnav() {
  const nav = $("#subnav"); if (!nav) return;
  const cur = activeTabId(); const meta = cur && TAB_BY_ID[cur];
  const list = meta ? panelsOf(meta.area) : [];
  nav.hidden = list.length < 2;
  nav.innerHTML = list.length < 2 ? "" : list.map(x => `<button type="button" class="subnav-btn${x.id === cur ? " active" : ""}" data-panel="${x.id}" aria-current="${x.id === cur ? "page" : "false"}">${esc(x.label)}</button>`).join("");
  nav.querySelector(".subnav-btn.active")?.scrollIntoView({ inline: "center", block: "nearest" });
}
$$(".area-btn[data-area]").forEach(b => b.setAttribute("aria-expanded", b.classList.contains("active") ? "true" : "false"));
EventBus.on("tab:activated", (p) => {
  if (!p || !TAB_BY_ID[p.id]) return;
  $$("#rail-areas .area-btn[data-area]").forEach(b => b.setAttribute("aria-expanded", b.classList.contains("active") ? "true" : "false"));
  renderSubnav();
  if (PHONE()) closeMore();
  // The drawer overlays the work column below 1500px (it pushes content only on very wide screens): a panel the user just
  // navigated to must not open half-hidden, so the drawer closes — its note + result survive for the next ✦.
  if (window.innerWidth < 1500) AiDrawer.close();
});
/* Keyboard: `[` / `]` cycle panels within the area, `1`–`5` jump areas — never while typing or while a layer is up. */
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.body.classList.contains("locked")) return;
  const tgt = e.target;
  if (tgt && (/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName) || tgt.isContentEditable)) return;
  if ($$(".welcome-scrim.open, .search-scrim.open, .lightbox.open").length) return;
  if (e.key === "[") { e.preventDefault(); cyclePanel(-1); }
  else if (e.key === "]") { e.preventDefault(); cyclePanel(1); }
  else if (/^[1-5]$/.test(e.key)) { e.preventDefault(); activateArea(AREAS[+e.key - 1].id); }
});

/* 전체 파기 — data, attachments, users AND the wrapped keys. Typed confirmation, no undo. */
$("#wipe-all")?.addEventListener("click", async () => {
  const typed = prompt(t("shell.wipePrompt"));
  if (typed == null) return;
  if (!isDestroyWord(typed)) { Toast.show({ tag: "system", html: esc(t("shell.wipeTypeWord")) }); return; }
  await destroyAll();
  location.reload();
});
/* Sync-status periodic refresh */
setInterval(() => SyncStatus.refresh(), 30000);
SyncStatus.refresh();

/* ─────────────────────────────────────────────────────────
   Welcome overlay — first-run + reopenable via 둘러보기.
   Includes "샘플 데이터로 둘러보기" which seeds every tool
   at once so 홈's todo list, KPIs, roster, accred all come
   alive in one click.
   ───────────────────────────────────────────────────────── */
const WELCOMED_KEY = "ui.welcomed";
function openWelcome() {
  const scrim = $("#welcome-scrim");
  if (!scrim) return;
  Dialog.open(scrim, "#welcome-seed");
  $("#welcome-dontshow").checked = !!Store.get(WELCOMED_KEY);
}
function closeWelcome(markSeen) {
  const scrim = $("#welcome-scrim");
  if (!scrim) return;
  Dialog.close(scrim);
  if (markSeen || $("#welcome-dontshow").checked) Store.set(WELCOMED_KEY, true);
  EventBus.emitLocal("welcome:closed", true);
}
$("#welcome-close")?.addEventListener("click", () => closeWelcome(false));
$("#welcome-blank")?.addEventListener("click", () => closeWelcome(true));
$("#welcome-scrim")?.addEventListener("click", e => {
  if (e.target.id === "welcome-scrim") closeWelcome(false);
});
$("#rail-demo")?.addEventListener("click", () => { closeMore(); openWelcome(); });
/* Info modal — sources + a READ-ONLY org summary; the editor itself is the 조직 › 기관 프로필 panel. */
function renderInfoOrg() {
  const el = $("#info-org"); if (!el) return;
  renderOrgReadOnly(el, Org.get(), { onEdit: () => { closeInfo(); openOrgEditor(); } });
}
function openInfo() { renderInfoOrg(); Dialog.open($("#info-scrim")); }
function closeInfo() { Dialog.close($("#info-scrim")); }
$("#rail-info")?.addEventListener("click", () => { closeMore(); openInfo(); });
$("#info-close")?.addEventListener("click", closeInfo);
$("#info-scrim")?.addEventListener("click", e => { if (e.target.id === "info-scrim") closeInfo(); });
Org.onChange(() => { if (Dialog.isOpen($("#info-scrim"))) renderInfoOrg(); });
/* Phone ⋯ sheet — the rail foot (lock · users · privacy · info · tour · search · AI · language · wipe) as a bottom sheet. */
function openMore()  { document.body.classList.add("more-open"); $("#bottombar-more")?.setAttribute("aria-expanded", "true"); }
function closeMore() { document.body.classList.remove("more-open"); $("#bottombar-more")?.setAttribute("aria-expanded", "false"); }
$("#bottombar-more")?.addEventListener("click", () => {
  document.body.classList.contains("more-open") ? closeMore() : openMore();
});
$("#more-scrim")?.addEventListener("click", closeMore);
EventBus.on("shell:closeAll", () => { closeMore(); AiDrawer.close(); });
/* Esc closes the top-most layer: search overlay → lightbox → any modal scrim (install/info/welcome/users/consent/preview)
   → AI drawer → ⋯ sheet. The lock screen is deliberately NOT closable with Esc. */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (document.body.classList.contains("locked")) return;
  if (Dialog.isOpen($("#search-scrim"))) GlobalSearch.close();
  else if (Dialog.isOpen($("#lightbox"))) Lightbox.close();
  else if ($$(".welcome-scrim.open").length) {
    const top = $$(".welcome-scrim.open").pop();
    if (top.id === "welcome-scrim") closeWelcome(false); else if (top.id === "org-scrim") OrgStep.close(); else Dialog.close(top);
  }
  else if (AiDrawer.isOpen()) AiDrawer.close();
  else if (document.body.classList.contains("more-open")) closeMore();
});
/* First-run 기관 정보 step — shown once, right after the workspace was created on THIS page load, before the
   welcome tour. Skippable ("나중에 입력"): the topbar org chip + 조직 › 기관 프로필 keep the editor reachable. */
const OrgStep = (() => {
  const scrim = () => $("#org-scrim");
  let mounted = false;
  function open() {
    if (!scrim()) return;
    if (!mounted) { renderOrgForm($("#org-step-form"), { prefix: "orgstep", skippable: true, onSaved: close, onSkip: close }); mounted = true; }
    Dialog.open(scrim(), "#orgstep-name");
  }
  function close() {
    if (!Dialog.isOpen(scrim())) return;
    Dialog.close(scrim());
    EventBus.emitLocal("orgstep:closed", Org.isComplete());
    if (!Store.get(WELCOMED_KEY)) setTimeout(openWelcome, 250);
  }
  $("#org-step-close")?.addEventListener("click", close);
  scrim()?.addEventListener("click", e => { if (e.target.id === "org-scrim") close(); });
  return { open, close };
})();
/* Open welcome on first visit. The flag is read at app:ready, not at import time: a backup restore
   on a fresh page writes ui.welcomed back between the two, and must not re-open the tour. */
EventBus.on("app:ready", () => {
  if (Lock.justCreated() && !Org.isComplete()) { setTimeout(() => OrgStep.open(), 350); return; }
  if (!Store.get(WELCOMED_KEY)) setTimeout(openWelcome, 350);
});

/* 조직 › 기관 프로필 — the promoted Org editor (mounted once the Store is unlocked). */
let orgPanelMounted = false;
function mountOrgPanel() {
  if (orgPanelMounted || !$("#org-panel-form")) return;
  renderOrgForm($("#org-panel-form"), { prefix: "orgpanel" });
  orgPanelMounted = true;
}
EventBus.on("app:ready", mountOrgPanel);
EventBus.on("session:unlocked", mountOrgPanel);

/* Topbar 기관 chip — the org name (or a nudge while the profile is incomplete); click → 조직 › 기관 프로필. */
function refreshOrgChip() {
  const chip = $("#topbar-org"), txt = $("#topbar-org-text"); if (!chip || !txt) return;
  const o = Org.get(), complete = Org.isComplete();
  chip.style.display = Session.isUnlocked() ? "inline-flex" : "none";
  txt.textContent = o.name || t("org.unsetChip");
  chip.classList.toggle("warn", !complete);
  chip.title = complete ? t("org.chipTitle", { kind: t("org.kind." + o.kind), rep: o.rep }) : t("org.chipTitleIncomplete");
}
const openOrgEditor = () => { mountOrgPanel(); activateTab("tab-org"); setTimeout(() => $("#orgpanel-name")?.focus({ preventScroll: true }), 80); };
$("#topbar-org")?.addEventListener("click", openOrgEditor);
// Tabs never import shell.js — 홈 (nudge) and the reporting panels' "기관 정보 수정" ask for the editor through this event.
EventBus.on("shell:openInfo", openOrgEditor);
Org.onChange(refreshOrgChip);
EventBus.on("session:unlocked", refreshOrgChip);
EventBus.on("session:locked", refreshOrgChip);
EventBus.on("app:ready", refreshOrgChip);
onLangChange(refreshOrgChip);

/* ─────────────────────────────────────────────────────────
   AI 코딩 어시스트 — right-side drawer (phone: full-screen sheet). Utility, not an area: activateTab("tab-ai", ctx)
   opens it, then nav.js emits tab:activated { id: "tab-ai", ctx } so tabs/tab7-ai.js fills the note exactly as before.
   ───────────────────────────────────────────────────────── */
const AiDrawer = (() => {
  const el = () => $("#ai-drawer");
  const isOpen = () => !!el()?.classList.contains("open");
  function open() {
    const d = el(); if (!d || isOpen()) return;
    d.inert = false; d.removeAttribute("aria-hidden");
    d.classList.add("open");
    document.body.classList.add("ai-open");
    $("#topbar-ai")?.setAttribute("aria-expanded", "true");
    closeMore();
    setTimeout(() => { if (!$("#ai-input")?.value) $("#ai-input")?.focus({ preventScroll: true }); }, 60);
    EventBus.emitLocal("ai:drawer", true);
  }
  function close() {
    const d = el(); if (!d || !isOpen()) return;
    d.classList.remove("open");
    document.body.classList.remove("ai-open");
    $("#topbar-ai")?.setAttribute("aria-expanded", "false");
    // Keep the note + result: the drawer is a workbench, not a dialog. inert so Tab never lands inside a closed sheet.
    if (d.contains(document.activeElement)) $("#topbar-ai")?.focus({ preventScroll: true });
    d.inert = true; d.setAttribute("aria-hidden", "true");
    EventBus.emitLocal("ai:drawer", false);
  }
  registerUtility("tab-ai", () => open());
  $("#topbar-ai")?.addEventListener("click", () => isOpen() ? close() : activateTab("tab-ai"));
  $("#rail-ai")?.addEventListener("click", () => { closeMore(); activateTab("tab-ai"); });
  $("#ai-drawer-close")?.addEventListener("click", close);
  return { open, close, isOpen };
})();

/* Restore last-viewed panel on load — after the drawer exists (a phone activation closes it). A retired id from an
   older build (tab-search / tab-ai) falls back to 홈. */
{
  const saved = Store.get("ui.activeTab");
  activateTab(saved && TAB_BY_ID[saved] ? saved : "tab-today");
}

/* ─────────────────────────────────────────────────────────
   Install — detect standalone, show ⋯-sheet/rail button +
   first-visit nudge, hand-walk the user through it.
   ───────────────────────────────────────────────────────── */
const Install = (() => {
  const NUDGE_KEY = "ui.install.nudge.dismissed";
  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  // Capture the install prompt on Android Chrome / Edge / Brave.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show native-install CTA in modal
    $("#install-native-row").style.display = "flex";
    $("#install-native-row-desktop").style.display = "flex";
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    $("#rail-install").style.display = "none";
    closeNudge();
    close();
    Toast.show({ tag: "system", html: t("shell.installedToast") });
  });

  function open(initialTab) {
    const sc = $("#install-scrim");
    if (!sc) return;
    Dialog.open(sc);
    if (initialTab) selectTab(initialTab);
    $("#install-dontshow").checked = !!Store.get(NUDGE_KEY);
  }
  function close() { Dialog.close($("#install-scrim")); }

  function selectTab(name) {
    $$('#install-scrim [data-install-tab]').forEach(b => {
      b.classList.toggle("active", b.dataset.installTab === name);
    });
    $$('#install-scrim [data-install-pane]').forEach(p => {
      p.classList.toggle("active", p.dataset.installPane === name);
    });
  }

  function showNudge() {
    if (Store.get(NUDGE_KEY)) return;
    if (isStandalone()) return;
    $("#install-nudge")?.classList.add("visible");
  }
  function closeNudge() { $("#install-nudge")?.classList.remove("visible"); }

  // Pick the right starting tab based on UA
  function detectTab() {
    const ua = navigator.userAgent || "";
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isMobile = /Android|iPhone|iPad/.test(ua);
    if (isiOS) return "ios";
    if (isMobile) return "android";
    return "desktop";
  }

  // ── Wire up DOM ──
  $("#rail-install")?.addEventListener("click", () => {
    closeMore();
    open(detectTab());
  });
  $("#install-close")?.addEventListener("click", close);
  $("#install-scrim")?.addEventListener("click", e => {
    if (e.target.id === "install-scrim") close();
  });
  $$('#install-scrim [data-install-tab]').forEach(b => {
    b.addEventListener("click", () => selectTab(b.dataset.installTab));
  });
  $("#install-dontshow")?.addEventListener("change", (e) => {
    Store.set(NUDGE_KEY, e.target.checked);
  });
  $("#install-nudge-open")?.addEventListener("click", () => {
    closeNudge();
    open(detectTab());
  });
  $("#install-nudge-dismiss")?.addEventListener("click", () => {
    Store.set(NUDGE_KEY, true);
    closeNudge();
  });

  // Native-prompt buttons (Android / desktop Chrome)
  async function triggerNative() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      ActivityLog.push("system", t("shell.logInstalled"), {});
    }
    deferredPrompt = null;
    $("#install-native-row").style.display = "none";
    $("#install-native-row-desktop").style.display = "none";
  }
  $("#install-native-btn")?.addEventListener("click", triggerNative);
  $("#install-native-btn-desktop")?.addEventListener("click", triggerNative);

  // Reveal the install button only when not already installed
  if (!isStandalone()) {
    $("#rail-install").style.display = "";
  }

  // First-visit nudge — never competes with the welcome overlay. On a first run the welcome opens
  // ~350 ms after app:ready (it was not yet open when this used to poll, so both showed at once);
  // now we wait for the explicit `welcome:closed` event instead of polling the DOM.
  function maybeNudge() {
    if (isStandalone()) return;
    if (!Store.get(WELCOMED_KEY) || $("#welcome-scrim")?.classList.contains("open")) {
      let done = false;
      EventBus.on("welcome:closed", () => { if (done) return; done = true; setTimeout(showNudge, 800); });
      return;
    }
    setTimeout(showNudge, 1200);
  }

  EventBus.on("app:ready", maybeNudge);

  return { open, close, isStandalone };
})();

/* ─────────────────────────────────────────────────────────
   ONE fictional clinic — 한솔한방병원. seedAll() seeds ONLY the shared entities (core/entities.js) here, then
   asks every tab module for its own sample via the `seed(ctx)` export (see boot() for the module convention).
   Every tab's sample data must reference these people / patients, never invent its own names.
   Demo logins issued by the seed (원장 only; PIN is the same for all three so a reviewer can switch users):
     윤지훈 · 원장  /  정수아 · 행정  /  한지우 · 원무   — PIN 0000
   ───────────────────────────────────────────────────────── */
const SEED_PIN = "0000";
const SEED = {
  org: { name: "한솔한방병원", ykiho: "11000123", biz: "123-45-67890", kind: "병원", rep: "윤지훈" },
  // reportedM / cmeM = months relative to today (one row has only a 취득일 → flagged; 행정·원무 carry no duty).
  staff: [
    { name: "윤지훈", job: "한의사",     licenseNo: "12345",  acquired: "2009-02-27", reportedM: 2 - 36,  cmeM: 8,  login: "원장" },
    { name: "박서연", job: "한의사",     licenseNo: "23456",  acquired: "1998-02-27", reportedM: null,    cmeM: -1 },
    { name: "김도현", job: "간호사",     licenseNo: "345678", acquired: "2014-02-25", reportedM: 5 - 36,  cmeM: 11 },
    { name: "이하은", job: "물리치료사", licenseNo: "45678",  acquired: "2016-03-01", reportedM: 22 - 36, cmeM: 4 },
    { name: "최민준", job: "간호조무사", licenseNo: "567890", acquired: "2018-01-20", reportedM: -2 - 36, cmeM: 7 },
    { name: "정수아", job: "행정", login: "행정" },
    { name: "한지우", job: "원무", login: "원무" }
  ],
  patients: [["P-2026-0142", ["자보", "교통사고"]], ["P-2026-0233", []], ["P-2026-0301", []], ["P-2026-0418", ["자보"]], ["P-2026-0509", []]],
  insurer: "삼성" // an insurer `value` from data/jabo.json (label 삼성화재)
};
const monthsFromNow = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
async function seedEntities() {
  const out = { staff: 0, logins: 0, patients: 0 };
  // Org — only fields still empty (whatever the user typed in the first-run step wins).
  const o = Org.get(), patch = {};
  for (const k of Object.keys(SEED.org)) if (!o[k] || (k === "kind" && Org.isEmpty())) patch[k] = SEED.org[k];
  if (Object.keys(patch).length) Org.set(patch);
  // Staff — idempotent by name + job; logins sequentially (each wraps the master key under a PIN).
  for (const s of SEED.staff) {
    let row = Staff.list().find(x => x.name === s.name && x.job === s.job);
    if (!row) {
      const id = Staff.add({ name: s.name, job: s.job, licenseNo: s.licenseNo || "", acquired: s.acquired || "", reported: s.reportedM == null ? "" : monthsFromNow(s.reportedM), cme: s.cmeM == null ? "" : monthsFromNow(s.cmeM) });
      row = Staff.get(id); out.staff++;
    }
    if (s.login && !row.userId && Session.isOwner()) {
      try { await Staff.issueLogin(row.id, { sysRole: s.login, pin: SEED_PIN }); out.logins++; } catch (e) { console.warn("seed login", s.name, e.message); }
    }
  }
  for (const [pid, tags] of SEED.patients) { if (!Patients.get(pid)) out.patients++; Patients.ensure(pid, { tags }); }
  if (!Insurers.lastUsed()) Insurers.setLastUsed(SEED.insurer);
  ActivityLog.add({ tag: "system", action: t("shell.logSeedEntities", { n: out.staff, l: out.logins, p: out.patients }), meta: { silent: true } });
  return out;
}
/* Seed-all — shared entities first, then every tab's seed() in module order (awaited one by one: the claims tools load
   the shared sample batch asynchronously and the year-end cross-check + 홈's KPIs read it), then land on 홈 whose
   todo list is now populated. */
async function seedAll() {
  let ent = null;
  try { ent = await seedEntities(); } catch (e) { console.warn("seedEntities", e); }
  for (const mod of tabModules) {
    try { await mod.seed({ DATA }); } catch (e) { console.warn("seed", mod.name, e); }
  }
  AiDrawer.close();
  activateTab("tab-today");
  Toast.show({ tag: "system", html: t("shell.seededToast") + (ent?.logins ? ` ${t("shell.seededLogins", { pin: SEED_PIN })}` : "") });
}
$("#welcome-seed")?.addEventListener("click", () => {
  seedAll();
  closeWelcome(true);
});

/* ─────────────────────────────────────────────────────────
   Global search (⌘K) — the former palette merged with code search. The shell only contributes the demo
   commands; entity + code results live in js/global-search.js.
   ───────────────────────────────────────────────────────── */
const GlobalSearch = initGlobalSearch({
  commands: () => [
    { label: t("shell.pal.ai"), meta: t("shell.pal.aiMeta"), run: () => activateTab("tab-ai"), glyph: "✦" },
    { label: t("shell.pal.seed"), meta: t("shell.pal.seedMeta"), run: seedAll, glyph: "▶" },
    { label: t("shell.pal.tour"), meta: t("shell.pal.tourMeta"), run: openWelcome, glyph: "?" },
    { label: t("shell.pal.ics"), meta: t("shell.pal.icsMeta"), run: () => { activateTab("tab-today"); setTimeout(() => $("#dday-ics")?.click(), 300); }, glyph: "↓" },
    { label: t("shell.pal.lang"), meta: t("shell.pal.langMeta"), run: () => setLang(isEn() ? "ko" : "en"), glyph: "文" },
    { label: t("shell.pal.lock"), meta: t("shell.pal.lockMeta"), run: () => Lock.lock("manual"), glyph: "🔒" },
    { label: t("shell.pal.users"), meta: t("shell.pal.usersMeta"), run: () => UsersPanel.open(), glyph: "👤" },
    { label: t("shell.pal.privacy"), meta: t("shell.pal.privacyMeta"), run: () => PrivacyPanel.open("status"), glyph: "▤" },
    { label: t("shell.pal.info"), meta: t("shell.pal.infoMeta"), run: openInfo, glyph: "ⓘ" },
    { label: t("shell.pal.wipe"), meta: t("shell.pal.wipeMeta"), run: () => $("#wipe-all")?.click(), glyph: "⌫" }
  ]
});
$("#rail-cmdk")?.addEventListener("click", () => { closeMore(); setTimeout(() => GlobalSearch.open(), 50); });
$("#topbar-search")?.addEventListener("click", () => GlobalSearch.open());

/* Topbar · today date + due-this-week chip */
(function topbarLive() {
  function refreshDue() {
    // Same calendar as 홈 (core/calendar.js allDeadlines: statutory + per-person from the Staff roster).
    const upcoming = allDeadlines().filter(d => d.daysLeft != null && d.daysLeft >= 0 && d.daysLeft <= 14);
    const chip = $("#topbar-due");
    const text = $("#topbar-due-text");
    if (!chip) return;
    if (!upcoming.length) { chip.style.display = "none"; return; }
    const next = upcoming[0];
    text.textContent = `D-${next.daysLeft} · ${next.title}`;
    chip.style.display = "inline-flex";
    chip.classList.toggle("urgent", next.daysLeft <= 3);
    chip.classList.toggle("warn", next.daysLeft > 3);
    chip.style.cursor = "pointer";
    chip.onclick = () => activateTab(next.link || "tab-today", next.ctx || undefined);
  }
  Staff.onChange(refreshDue);
  Org.onChange(refreshDue); // 의원급 drops the September 비급여 window
  EventBus.on("app:ready", refreshDue);
  onLangChange(refreshDue);
  setInterval(refreshDue, 60000);
})();

/* ─────────────────────────────────────────────────────────
   Boot — load data, then wire each tab
   ───────────────────────────────────────────────────────── */
const DATA = { kcd: null, jabo: null, bigeup: null, retention: null };

/* TAB MODULE CONVENTION — every js/tabs/*.js module exports exactly
     init(ctx)   wire the panel once (ctx = { DATA })
     seed(ctx)   fill the panel with ITS sample state for the shared fictional clinic (called by seedAll() after the
                 entities are seeded; must reference Staff / Patients / Org from core/entities.js, never invent
                 names). May return a promise — seedAll() awaits it. Modules with nothing of their own export a no-op.
   main.js passes the module namespaces (import * as T …) in seed order: claims tools first (they create the shared
   batch), reporting next, utilities, roster/accred, the claims landing, 홈 last (it derives everything).
   boot() waits for the first unlock (Lock.ready) so tabs initialise against a decrypted Store. */
let tabModules = [];
function boot(mods, { version = "dev" } = {}) {
  const ver = $("#info-version"); if (ver) ver.dataset.version = version;
  showVersion(version);
  tabModules = mods;
  return Promise.all([
    sessionReady,
    loadJSON("./data/kcd9.json"),
    loadJSON("./data/jabo.json"),
    loadJSON("./data/bigeup.json"),
    loadJSON("./data/retention.json")
  ]).then(([, kcd, jabo, bigeup, ret]) => {
    DATA.kcd = kcd; DATA.jabo = jabo; DATA.bigeup = bigeup; DATA.retention = ret;
    Insurers.load(DATA); // shared insurer list (data/jabo.json) before any tab reads it
    for (const mod of tabModules) mod.init({ DATA });
    // Local only: broadcasting this made a second tab's boot re-open the first tab's welcome overlay.
    EventBus.emitLocal("app:ready", true);
  }).catch(err => {
    console.error("Data load failed:", err);
    const msg = $("#sync-msg"); if (msg) msg.textContent = t("shell.dataLoadFail");
    const led = $("#sync-led"); if (led) { led.classList.remove("idle", "live"); led.classList.add("warn"); }
    Toast.show({
      tag: "system", ttl: 0,
      html: t("shell.dataLoadToast"),
      action: { label: t("common.retry"), fn: () => location.reload() }
    });
  });
}
/* Info modal "버전" line — app version + the service-worker cache actually installed in this browser. */
async function showVersion(version) {
  const el = $("#info-version"); if (!el) return;
  let cache = t("shell.notInstalled");
  try { const keys = await caches.keys(); cache = keys.filter(k => k.startsWith("vibe-clinic-admin-")).sort().pop() || t("shell.notInstalled"); } catch {}
  const ws = Session.workspaceId();
  el.textContent = t("shell.versionLine", { v: version, c: cache, ws: ws ? ws.slice(0, 8) + "…" : t("shell.none") });
}
EventBus.on("session:unlocked", () => { const el = $("#info-version"); if (el?.dataset.version) showVersion(el.dataset.version); });
onLangChange(() => { const el = $("#info-version"); if (el?.dataset.version) showVersion(el.dataset.version); if (Dialog.isOpen($("#info-scrim"))) renderInfoOrg(); });
// Vendored SheetJS failed to load (onerror flag set in <head>) — say so once everything has settled.
window.addEventListener("load", () => {
  if (document.documentElement.dataset.xlsxFailed) {
    Toast.show({ tag: "system", ttl: 0, html: t("shell.xlsxFailToast"), action: { label: t("common.reload"), fn: () => location.reload() } });
  }
});
export { DATA, boot, seedAll, seedEntities, SEED, SEED_PIN, openWelcome, closeWelcome, openInfo, closeInfo, openMore, closeMore, Install, GlobalSearch, AiDrawer, OrgStep };
