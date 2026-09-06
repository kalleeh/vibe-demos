/* clinic-admin — app chrome — rail/drawer, tab restore, 전체 파기, welcome/info/install modals, seed-all, ⌘K palette, topbar due chip, data boot
   Security pass: the lock screen (js/security/lockscreen.js) is initialised here and boot() waits for the
   first unlock before loading data / initialising tabs, so tabs never see a locked Store at init.
   i18n: the KO|EN toggles (lock card, topbar, drawer, palette) all route through setLang(); the shell's
   onLangChange listener is registered at import time — before any tab's — so it runs first: it re-paints the
   crumb, palette and topbar chips, then emits `lang:changed` on the EventBus for anything else. Tabs subscribe
   with their own onLangChange and re-render from the state they already hold (nothing is lost on toggle). */
import { $, $$, esc, redactSubject, Toast, Dialog, Lightbox } from "./core/ui.js";
import { t, getLang, setLang, onLangChange, isEn } from "./core/i18n.js";
import { Store, EventBus, ActivityLog, SyncStatus } from "./core/store.js";
import { TABS, TAB_BY_ID, activateTab, refreshCrumb, activeTabId } from "./core/nav.js";
import { loadJSON } from "./core/files.js";
import { allDeadlines } from "./core/calendar.js";
import { Org, Staff, Patients, Insurers } from "./core/entities.js";
import { renderOrgForm } from "./core/org-form.js";
import { Session } from "./security/session.js";
import { destroyAll } from "./security/lifecycle.js";
import { initSecurityUI, Lock, UsersPanel, PrivacyPanel, isDestroyWord } from "./security/lockscreen.js";
import { ACCRED_ITEMS, accredText } from "./tabs/tab9-accred.js";

/* Language toggle — one delegated handler for every .lang-toggle (lock card, topbar, drawer). The lock card
   sits outside the inert shell, so it stays clickable while locked. */
document.addEventListener("click", (e) => {
  const b = e.target.closest?.(".lang-toggle button[data-lang]");
  if (b) setLang(b.dataset.lang);
});
onLangChange(() => {
  const id = activeTabId(); if (id) refreshCrumb(id);
  SyncStatus.refresh();
  EventBus.emitLocal("lang:changed", getLang());
});

/* Lock screen first — it covers the shell until a PIN unlocks the workspace (or one is created). */
const sessionReady = initSecurityUI();

/* Rail buttons, last-tab restore, wipe-all, sync-status ticker */
$$(".rail-btn[data-panel]").forEach(btn => {
  btn.addEventListener("click", () => activateTab(btn.dataset.panel));
});
/* Restore last-viewed tab on load */
{
  const saved = Store.get("ui.activeTab");
  if (saved && TAB_BY_ID[saved]) activateTab(saved);
  else activateTab("tab-today");
}
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
   Welcome overlay — first-run + reopenable via 시연 chip.
   Includes "샘플 데이터로 둘러보기" which seeds every tab
   at once so the dashboard, charts, license tracker, accred
   all come alive in one click.
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
$("#rail-demo")?.addEventListener("click", () => { closeRail(); openWelcome(); });
/* Info modal — hosts the compact 기관 프로필 editor (mounted on first open). */
let infoOrgMounted = false;
function openInfo() {
  if (!infoOrgMounted && $("#info-org")) { renderOrgForm($("#info-org"), { prefix: "orginfo" }); infoOrgMounted = true; }
  Dialog.open($("#info-scrim"));
}
function closeInfo() { Dialog.close($("#info-scrim")); }
$("#rail-info")?.addEventListener("click", () => { closeRail(); openInfo(); });
$("#info-close")?.addEventListener("click", closeInfo);
$("#info-scrim")?.addEventListener("click", e => { if (e.target.id === "info-scrim") closeInfo(); });
/* Hamburger / off-canvas drawer */
function openRail()  { document.body.classList.add("rail-open"); }
function closeRail() { document.body.classList.remove("rail-open"); }
$("#hamburger")?.addEventListener("click", () => {
  document.body.classList.contains("rail-open") ? closeRail() : openRail();
});
$("#rail-scrim")?.addEventListener("click", closeRail);
/* Auto-close drawer when a section is picked on mobile */
EventBus.on("tab:activated", () => {
  if (window.innerWidth <= 880) closeRail();
});
/* Esc closes the top-most layer: palette → lightbox → any modal scrim (install/info/welcome/users/privacy/AI) → drawer.
   The lock screen is deliberately NOT closable with Esc. */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (document.body.classList.contains("locked")) return;
  if (Dialog.isOpen($("#palette-scrim"))) Palette.close();
  else if (Dialog.isOpen($("#lightbox"))) Lightbox.close();
  else if ($$(".welcome-scrim.open").length) {
    const top = $$(".welcome-scrim.open").pop();
    if (top.id === "welcome-scrim") closeWelcome(false); else if (top.id === "org-scrim") OrgStep.close(); else Dialog.close(top);
  }
  else if (document.body.classList.contains("rail-open")) closeRail();
});
/* Rail-foot Cmd+K trigger */
$("#rail-cmdk")?.addEventListener("click", () => {
  closeRail();
  // Palette opens itself on next tick
  setTimeout(() => Palette.open(), 50);
});
/* First-run 기관 정보 step — shown once, right after the workspace was created on THIS page load, before the
   welcome tour. Skippable ("나중에 입력"): the topbar org chip + the ⓘ 정보 modal keep the editor reachable. */
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

/* Topbar 기관 chip — the org name (or a nudge while the profile is incomplete); click → ⓘ 정보 editor. */
function refreshOrgChip() {
  const chip = $("#topbar-org"), txt = $("#topbar-org-text"); if (!chip || !txt) return;
  const o = Org.get(), complete = Org.isComplete();
  chip.style.display = Session.isUnlocked() ? "inline-flex" : "none";
  txt.textContent = o.name || t("org.unsetChip");
  chip.classList.toggle("warn", !complete);
  chip.title = complete ? t("org.chipTitle", { kind: t("org.kind." + o.kind), rep: o.rep }) : t("org.chipTitleIncomplete");
}
const openOrgEditor = () => { openInfo(); setTimeout(() => $("#orginfo-name")?.focus({ preventScroll: true }), 80); };
$("#topbar-org")?.addEventListener("click", openOrgEditor);
// Tabs never import shell.js — 00 오늘 (nudge, 03/04 "기관 정보 수정") ask for the editor through this event.
EventBus.on("shell:openInfo", openOrgEditor);
Org.onChange(refreshOrgChip);
EventBus.on("session:unlocked", refreshOrgChip);
EventBus.on("session:locked", refreshOrgChip);
EventBus.on("app:ready", refreshOrgChip);
onLangChange(refreshOrgChip);

/* ─────────────────────────────────────────────────────────
   Install — detect standalone, show rail-foot button +
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
    closeRail();
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

  // Reveal rail button only when not already installed
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
/* Seed-all — shared entities first, then every tab's seed() in module order (awaited one by one: 01/02 load the
   shared sample batch asynchronously and 03's cross-check + 00's KPIs read it), then land on the dashboard. */
async function seedAll() {
  let ent = null;
  try { ent = await seedEntities(); } catch (e) { console.warn("seedEntities", e); }
  for (const mod of tabModules) {
    try { await mod.seed({ DATA }); } catch (e) { console.warn("seed", mod.name, e); }
  }
  activateTab("tab-today");
  Toast.show({ tag: "system", html: t("shell.seededToast") + (ent?.logins ? ` ${t("shell.seededLogins", { pin: SEED_PIN })}` : "") });
}
$("#welcome-seed")?.addEventListener("click", () => {
  seedAll();
  closeWelcome(true);
});

/* ─────────────────────────────────────────────────────────
   Cmd+K command palette — fuzzy search across tabs,
   saved 자보 cases, licenses, accred items, KCD codes,
   and demo commands. Net new "verb layer" of the app.
   ───────────────────────────────────────────────────────── */
const Palette = (() => {
  const scrim = $("#palette-scrim");
  const input = $("#palette-input");
  const results = $("#palette-results");
  let items = [];
  let sel = 0;
  const KINDS = ["go", "cmd", "kcd", "jabo", "license", "accred"];
  const kindLabel = (k) => t("shell.pal.kind." + k);
  function buildItems(query) {
    const q = (query || "").trim().toLowerCase();
    const out = [];
    // Tabs
    for (const tb of TABS) {
      if (!q || tb.label.toLowerCase().includes(q) || tb.section.toLowerCase().includes(q) || tb.num.includes(q)) {
        out.push({ kind: "go", glyph: tb.glyph, label: tb.label, meta: `${tb.section} · ${tb.num}`, run: () => activateTab(tb.id) });
      }
    }
    // Demo commands
    const cmds = [
      { label: t("shell.pal.seed"), meta: t("shell.pal.seedMeta"), run: seedAll, glyph: "▶" },
      { label: t("shell.pal.tour"), meta: t("shell.pal.tourMeta"), run: openWelcome, glyph: "?" },
      { label: t("shell.pal.ics"), meta: t("shell.pal.icsMeta"), run: () => { activateTab("tab-today"); setTimeout(() => $("#dday-ics")?.click(), 300); }, glyph: "↓" },
      { label: t("shell.pal.lang"), meta: t("shell.pal.langMeta"), run: () => setLang(isEn() ? "ko" : "en"), glyph: "文" },
      { label: t("shell.pal.lock"), meta: t("shell.pal.lockMeta"), run: () => Lock.lock("manual"), glyph: "🔒" },
      { label: t("shell.pal.users"), meta: t("shell.pal.usersMeta"), run: () => UsersPanel.open(), glyph: "👤" },
      { label: t("shell.pal.privacy"), meta: t("shell.pal.privacyMeta"), run: () => PrivacyPanel.open("status"), glyph: "▤" },
      { label: t("shell.pal.wipe"), meta: t("shell.pal.wipeMeta"), run: () => $("#wipe-all")?.click(), glyph: "⌫" }
    ];
    for (const c of cmds) {
      if (!q || c.label.toLowerCase().includes(q) || (c.meta || "").toLowerCase().includes(q)) {
        out.push({ kind: "cmd", ...c });
      }
    }
    // KCD codes (search ko/en/code) — only when query present. data/kcd9.json holds `codes`.
    if (q && q.length >= 2 && Array.isArray(DATA.kcd?.codes)) {
      const matches = DATA.kcd.codes.filter(c =>
        c.code?.toLowerCase().includes(q) || c.edi?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q)
      ).slice(0, 6);
      for (const c of matches) {
        const name = isEn() && c.name_en ? `${c.name_en} (${c.name})` : c.name;
        out.push({ kind: "kcd", glyph: "K", label: name, meta: c.code + (c.edi && c.edi !== c.code ? ` · EDI ${c.edi}` : ""), run: () => { activateTab("tab-search"); setTimeout(() => EventBus.emit("search:query", c.code), 200); } });
      }
    }
    // Saved 자보 cases — file reconciliations by 명세서 count, manual cases pseudonymised (****1234); never a name
    const jhist = Store.get("jabo.history", []) || [];
    for (const j of jhist.slice(0, 8)) {
      const cap = j.kind === "recon" ? t("shell.pal.reconCap", { n: j.stmts || 0 }) : `${redactSubject({ name: j.name, pid: j.pid })} · ${j.insurer || "—"}`;
      if (!q || cap.toLowerCase().includes(q)) {
        out.push({ kind: "jabo", glyph: "J", label: cap, meta: t("shell.pal.jaboMeta", { date: j.date || "", n: j.itemCount || 0 }), run: () => activateTab("tab-jabo") });
      }
    }
    // Staff roster — pseudonymised (한의사 윤○○); 원무·행정·기타 carry no 신고 duty, so no deadline. Lands on the row.
    for (const s of Staff.list()) {
      const cap = Staff.ref(s);
      if (!q || cap.toLowerCase().includes(q)) {
        out.push({ kind: "license", glyph: "L", label: cap, meta: Staff.hasDuty(s.job) ? t("license.dueMeta", { d: s.expiry || "—" }) : t("license.noDuty"), run: () => activateTab("tab-license", { staffId: s.id }) });
      }
    }
    // Accreditation items
    if (q && q.length >= 2) {
      for (const cat of ACCRED_ITEMS) {
        for (const it of cat.items) {
          const label = accredText(it, "label");
          if (label.toLowerCase().includes(q) || it.label.toLowerCase().includes(q)) {
            out.push({ kind: "accred", glyph: "C", label, meta: accredText(cat, "title"), run: () => activateTab("tab-accred") });
          }
        }
      }
    }
    return out.slice(0, 40);
  }
  function render() {
    if (!items.length) {
      results.innerHTML = `<div class="palette-empty">${esc(t("shell.pal.empty"))}</div>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    // Group by kind
    const groups = {};
    items.forEach((it, i) => { (groups[it.kind] = groups[it.kind] || []).push({ it, i }); });
    let html = "";
    for (const k of KINDS) {
      if (!groups[k]) continue;
      html += `<div class="palette-section-label">${esc(kindLabel(k))}</div>`;
      for (const { it, i } of groups[k]) {
        html += `<div class="palette-item ${i === sel ? "sel" : ""}" data-i="${i}" id="palette-opt-${i}" role="option" aria-selected="${i === sel}">
          <span class="glyph">${it.glyph || "·"}</span>
          <span class="label">${esc(it.label)}${it.meta ? `<span class="meta">${esc(it.meta)}</span>` : ""}</span>
          <span class="kind">${esc(kindLabel(it.kind))}</span>
        </div>`;
      }
    }
    results.innerHTML = html;
    results.querySelectorAll(".palette-item").forEach(el => {
      el.addEventListener("click", () => { run(parseInt(el.dataset.i, 10)); });
    });
    const selEl = results.querySelector(".palette-item.sel");
    if (selEl) { selEl.scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", selEl.id); }
  }
  function refresh(q) {
    items = buildItems(q);
    if (sel >= items.length) sel = 0;
    render();
  }
  function open() {
    Dialog.open(scrim, input);
    input.value = "";
    sel = 0;
    refresh("");
  }
  function close() { Dialog.close(scrim); }
  function run(i) {
    const it = items[i];
    if (!it) return;
    close();
    try { it.run(); } catch (e) { console.error(e); }
  }
  input?.addEventListener("input", e => { sel = 0; refresh(e.target.value); });
  input?.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  scrim?.addEventListener("click", e => { if (e.target.id === "palette-scrim") close(); });
  document.addEventListener("keydown", e => {
    const isK = (e.key === "k" || e.key === "K");
    if (isK && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (scrim.classList.contains("open")) close(); else open();
    }
  });
  $("#topbar-cmdk")?.addEventListener("click", open);
  onLangChange(() => { if (Dialog.isOpen(scrim)) refresh(input.value); });
  return { open, close, refresh };
})();

/* Topbar · today date + due-this-week chip */
(function topbarLive() {
  function refreshDue() {
    // Same calendar as 00 오늘 (core/calendar.js allDeadlines: statutory + per-person from the Staff roster).
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

/* TAB MODULE CONVENTION — every js/tabs/tabN-*.js exports exactly
     init(ctx)   wire the panel once (ctx = { DATA })
     seed(ctx)   fill the panel with ITS sample state for the shared fictional clinic (called by seedAll() after the
                 entities are seeded; must reference Staff / Patients / Org from core/entities.js, never invent
                 names). May return a promise — seedAll() awaits it. Tabs with nothing of their own (00, 08) export a no-op.
   main.js passes the module namespaces (import * as T1 …) in the order 1‥9 then 0 — exactly the former inline
   order. boot() waits for the first unlock (Lock.ready) so tabs initialise against a decrypted Store. */
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
onLangChange(() => { const el = $("#info-version"); if (el?.dataset.version) showVersion(el.dataset.version); });
// Vendored SheetJS failed to load (onerror flag set in <head>) — say so once everything has settled.
window.addEventListener("load", () => {
  if (document.documentElement.dataset.xlsxFailed) {
    Toast.show({ tag: "system", ttl: 0, html: t("shell.xlsxFailToast"), action: { label: t("common.reload"), fn: () => location.reload() } });
  }
});
export { DATA, boot, seedAll, seedEntities, SEED, SEED_PIN, openWelcome, closeWelcome, openInfo, closeInfo, openRail, closeRail, Install, Palette, OrgStep };
