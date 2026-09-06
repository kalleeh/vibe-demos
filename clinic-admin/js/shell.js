/* clinic-admin — app chrome — rail/drawer, tab restore, 전체 파기, welcome/info/install modals, seed-all, ⌘K palette, topbar due chip, data boot
   Security pass: the lock screen (js/security/lockscreen.js) is initialised here and boot() waits for the
   first unlock before loading data / initialising tabs, so tabs never see a locked Store at init.
   i18n: the KO|EN toggles (lock card, topbar, drawer, palette) all route through setLang(); the shell's
   onLangChange listener is registered at import time — before any tab's — so it runs first: it re-paints the
   crumb, palette and topbar chips, then emits `lang:changed` on the EventBus for anything else. Tabs subscribe
   with their own onLangChange and re-render from the state they already hold (nothing is lost on toggle). */
import { $, $$, esc, redactSubject, redactStaff, Toast, Dialog, Lightbox } from "./core/ui.js";
import { t, getLang, setLang, onLangChange, isEn } from "./core/i18n.js";
import { Store, EventBus, ActivityLog, SyncStatus } from "./core/store.js";
import { TABS, TAB_BY_ID, activateTab, refreshCrumb, activeTabId } from "./core/nav.js";
import { loadJSON } from "./core/files.js";
import { statutoryDeadlines } from "./core/calendar.js";
import { Session } from "./security/session.js";
import { destroyAll } from "./security/lifecycle.js";
import { initSecurityUI, Lock, UsersPanel, PrivacyPanel, isDestroyWord } from "./security/lockscreen.js";
import { ACCRED_ITEMS, accredText } from "./tabs/tab9-accred.js";
import { hasDuty } from "./tabs/tab8-license.js";

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
/* Info modal */
function openInfo() { Dialog.open($("#info-scrim")); }
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
    if (top.id === "welcome-scrim") closeWelcome(false); else Dialog.close(top);
  }
  else if (document.body.classList.contains("rail-open")) closeRail();
});
/* Rail-foot Cmd+K trigger */
$("#rail-cmdk")?.addEventListener("click", () => {
  closeRail();
  // Palette opens itself on next tick
  setTimeout(() => Palette.open(), 50);
});
/* Open welcome on first visit. The flag is read at app:ready, not at import time: a backup restore
   on a fresh page writes ui.welcomed back between the two, and must not re-open the tour. */
EventBus.on("app:ready", () => { if (!Store.get(WELCOMED_KEY)) setTimeout(openWelcome, 350); });

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

/* Seed-all — fills every tool tab with sample state in one shot. */
function seedAll() {
  // Tab 1 — trigger sample-kcd's run-kcd action
  try { $('[data-action="run-kcd"]')?.click(); } catch {}
  // Tab 2 — sample jabo case
  try { $('[data-action="run-jabo"]')?.click(); } catch {}
  // Tab 3 — yearend
  try { $('[data-action="run-ye"]')?.click(); } catch {}
  // Tab 4 — bigeup
  try { $('[data-action="run-bigeup"]')?.click(); } catch {}
  // Tab 5 — retention
  try { $('[data-action="run-ret"]')?.click(); } catch {}
  // Tab 6 — search
  try { $('[data-action="run-search"]')?.click(); } catch {}
  // Tab 7 — AI canned demo
  try { $('[data-action="run-ai"]')?.click(); } catch {}
  // Tab 8 — sample 5 staff
  try { $("#lic-sample")?.click(); } catch {}
  // Tab 9 — pre-check ~40% of accred items
  try {
    const accred = Store.get("accred.checked", {});
    const all = ACCRED_ITEMS.flatMap(c => c.items);
    const n = Math.floor(all.length * 0.4);
    for (let i = 0; i < n; i++) accred[all[i].id] = true;
    Store.set("accred.checked", accred);
  } catch {}
  // Land on dashboard so the user sees the result
  activateTab("tab-today");
  Toast.show({ tag: "system", html: t("shell.seededToast") });
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
    // Licenses — pseudonymised (한의사 윤○○); 원무·기타 carry no 신고 duty, so no deadline.
    const lics = Store.get("license.list", []) || [];
    for (const l of lics) {
      const cap = redactStaff(l);
      if (!q || cap.toLowerCase().includes(q)) {
        out.push({ kind: "license", glyph: "L", label: cap, meta: hasDuty(l.role) ? t("license.dueMeta", { d: l.expiry || "—" }) : t("license.noDuty"), run: () => activateTab("tab-license") });
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
    const days = (iso) => {
      const t0 = new Date(iso + "T09:00:00").getTime();
      return Math.ceil((t0 - Date.now()) / 86400000);
    };
    // Same calendar as 00 오늘 (core/calendar.js) — never a second copy of the statutory dates.
    const fixed = statutoryDeadlines().map(d => ({ title: d.title, date: d.date }));
    const lics = Store.get("license.list", []) || [];
    for (const l of lics) {
      if (l.expiry && hasDuty(l.role)) fixed.push({ title: t("license.dlReport", { who: redactStaff(l) }), date: l.expiry });
      if (l.cme) fixed.push({ title: t("license.dlCme", { who: redactStaff(l) }), date: l.cme });
    }
    const upcoming = fixed
      .map(d => ({ ...d, d: days(d.date) }))
      .filter(d => d.d >= 0 && d.d <= 14)
      .sort((a, b) => a.d - b.d);
    const chip = $("#topbar-due");
    const text = $("#topbar-due-text");
    if (!chip) return;
    if (!upcoming.length) { chip.style.display = "none"; return; }
    const next = upcoming[0];
    text.textContent = `D-${next.d} · ${next.title}`;
    chip.style.display = "inline-flex";
    chip.classList.toggle("urgent", next.d <= 3);
    chip.classList.toggle("warn", next.d > 3);
    chip.style.cursor = "pointer";
    chip.onclick = () => activateTab("tab-today");
  }
  EventBus.on("store:license.list", refreshDue);
  EventBus.on("app:ready", refreshDue);
  onLangChange(refreshDue);
  setInterval(refreshDue, 60000);
})();

/* ─────────────────────────────────────────────────────────
   Boot — load data, then wire each tab
   ───────────────────────────────────────────────────────── */
const DATA = { kcd: null, jabo: null, bigeup: null, retention: null };

// `initTabs` is the ordered list of initTabN functions (main.js passes 1‥9 then 0,
// exactly the former inline order). Each receives ctx = { DATA }.
// Waits for the first unlock (Lock.ready) so tabs initialise against a decrypted Store.
function boot(initTabs, { version = "dev" } = {}) {
  const ver = $("#info-version"); if (ver) ver.dataset.version = version;
  showVersion(version);
  return Promise.all([
    sessionReady,
    loadJSON("./data/kcd9.json"),
    loadJSON("./data/jabo.json"),
    loadJSON("./data/bigeup.json"),
    loadJSON("./data/retention.json")
  ]).then(([, kcd, jabo, bigeup, ret]) => {
    DATA.kcd = kcd; DATA.jabo = jabo; DATA.bigeup = bigeup; DATA.retention = ret;
    for (const init of initTabs) init({ DATA });
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
export { DATA, boot, seedAll, openWelcome, closeWelcome, openInfo, closeInfo, openRail, closeRail, Install, Palette };
